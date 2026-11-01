import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import {createHash} from 'node:crypto';
import {toNumber} from '../src/results/values.js';
import {resolveCostSignal, resolveCostComparison, bestCostIndices,
  costComparisonDelta, costPercent, costDrilldown} from '../src/results/cost.js';

const rows = entries => Object.entries(entries).map(([label, value], i) => ({key: `${label}-${i}`, label, value}));
const signal = entries => resolveCostSignal(rows(entries));
const pair = (control, reference, extra = {}) => signal({district_cost_total_control_eur: control,
  district_cost_total_business_as_usual_eur: reference, ...extra});
const cost = value => signal({district_cost_total_control_eur: value});

for (const [control, reference, saving, pct, tone] of [
  [80, 100, 20, 20, 'better'], [120, 100, -20, -20, 'worse'], [100, 100, 0, 0, 'neutral'],
  [-120, -100, 20, 20, 'better'], [-80, -100, -20, -20, 'worse'], [0, -100, -100, -100, 'worse'],
  [-20, 100, 120, 120, 'better'], [20, -100, -120, -120, 'worse'], [0, 100, 100, 100, 'better'],
  [-20, 0, 20, null, 'better'], [20, 0, -20, null, 'worse'], [0, 0, 0, null, 'neutral']
]) test(`saving and percentage use the same sign: control=${control}, reference=${reference}`, () => {
  const s = pair(control, reference, {district_cost_ratio_to_business_as_usual_total_ratio: reference ? control / reference : 1});
  assert.equal(s.kind, 'cost-saving');assert.equal(s.primary, saving);assert.equal(s.delta, saving);
  assert.equal(s.deltaPct, pct);assert.equal(s.tone, tone);assert.equal(s.referenceSource, 'bau');
  assert(!Object.is(s.primary, -0));
});

test('a fully resolved BAU pair does not borrow the legacy delta or ratio', () => {
  const s = pair(80, 100, {district_cost_total_baseline_eur: 30, district_cost_total_delta_eur: 50,
    district_cost_ratio_to_baseline_total_ratio: 80 / 30});
  assert.equal(s.primary, 20);assert.equal(s.deltaPct, 20);assert.equal(s.reference, 100);
});
test('BAU delta without its reference is not divided by a legacy reference', () => {
  const s = signal({cost_delta_vs_bau_eur: -20, cost_total_baseline_eur: 100});
  assert.equal(s.primary, 20);assert.equal(s.reference, null);assert.equal(s.deltaPct, null);assert.equal(s.policy, null);
});
test('an absent or null BAU can use a correctly labelled legacy baseline', () => {
  const s = signal({district_cost_total_control_eur: 80, district_cost_total_business_as_usual_eur: null,
    district_cost_total_baseline_eur: 100, district_cost_total_delta_eur: -20});
  assert.equal(s.referenceSource, 'baseline');assert.equal(s.title, 'Cost saving vs legacy baseline');assert.equal(s.primary, 20);
});
test('invalid values and reference-only exports never become a reported saving', () => {
  for (const missing of [null, undefined, NaN, Infinity, -Infinity]) {
    const s = pair(missing, 100);assert.equal(s.reported, false);assert.equal(s.primary, null);
  }
});
for (const [key, source] of [['cost_saving_vs_bau_eur','bau'], ['cost_saving_vs_reference_eur','reference'],
  ['cost_saving_vs_rbcsmart_eur','rbcsmart']]) test(`an explicit saving stays a saving: ${key}`, () => {
  const s = signal({[key]: 20});assert.equal(s.primary, 20);assert.equal(s.kind, 'cost-saving');
  assert.equal(s.referenceSource, source);assert.equal(s.deltaPct, null);assert.equal(s.policy, null);
});
for (const [key, source] of [['cost_delta_vs_reference_eur','reference'], ['building_cost_total_delta_eur','baseline'],
  ['cost_delta_vs_bau_eur','bau']]) test(`a cost change is displayed with the opposite saving sign: ${key}`, () => {
  const s = signal({[key]: -20});assert.equal(s.primary, 20);assert.equal(s.delta, 20);assert.equal(s.referenceSource, source);
});
test('cost matching is exact; a daily average, count or market saving is not total control cost', () => {
  const s = signal({district_cost_daily_average_control_eur: 9, district_cost_community_market_savings_total_eur: 20,
    district_equity_audit_excluded_unknown_cost_count: 5});
  assert.equal(s.reported, false);
  assert.equal(signal({district_cost_total_control_eur: 80, district_cost_daily_average_control_eur: 9}).primary, 80);
});
test('absolute cost, including zero/negative cost, has currency but no arbitrary better/worse colour', () => {
  for (const v of [80, 0, -20]) {
    const s = cost(v);assert.equal(s.primary, v);assert.equal(s.kind, 'cost-total');assert.equal(s.unit, 'EUR');
    assert.equal(s.tone, 'neutral');assert.equal(s.referenceMode, 'none');assert.equal(s.comparisonDirection, 'lower-is-better');
  }
});
test('legacy bare cost remains visible with unspecified units and no inferred currency/reference', () => {
  const s = signal({cost: .8});assert.equal(s.primary, .8);assert.equal(s.kind, 'cost-reported');
  assert.equal(s.unit, '');assert.equal(s.referenceMode, 'none');assert.equal(s.comparisonDirection, 'neutral');
});
test('ratios remain dimensionless even when greater than ten or negative', () => {
  for (const v of [.8, 20, -2, 0]) {
    const s = signal({cost_ratio_to_baseline: v});assert.equal(s.primary, v);assert.equal(s.kind, 'cost-ratio');
    assert.equal(s.valueStyle, 'ratio');assert.equal(s.unit, 'x');assert.equal(s.delta, null);assert.equal(s.deltaPct, null);
    assert.equal(s.comparisonDirection, 'neutral');
  }
});
test('ratio comparison direction follows the sign of a known reference', () => {
  assert.equal(signal({cost_total_baseline: -100, cost_ratio_to_baseline: 1.2}).comparisonDirection, 'higher-is-better');
  assert.equal(signal({cost_total_baseline: 100, cost_ratio_to_baseline: .8}).comparisonDirection, 'lower-is-better');
});
test('normalised aliases retain supported separator/case variations', () => {
  assert.equal(signal({'District Cost Total Control EUR': 80, 'District Cost Total Business As Usual EUR': 100}).primary, 20);
});
test('extreme amounts and zero references do not generate non-finite derived values', () => {
  for (const [a, b] of [[Number.MAX_VALUE, -Number.MAX_VALUE], [1, Number.MIN_VALUE], [0, -0]]) {
    const s = pair(a, b);
    for (const field of ['primary', 'delta', 'deltaPct', 'ratio']) assert(s[field] === null || Number.isFinite(s[field]), field);
  }
});
test('absolute costs 80 and 100 rank 80 first and report the correct difference', () => {
  const c = resolveCostComparison([cost(100), cost(80)]);assert.equal(c.title, 'Cost');assert(c.comparable);
  assert.deepEqual(bestCostIndices(c.signals), [1]);assert.deepEqual(costComparisonDelta(c.signals[1], c.signals[0]), {value: -20, tone: 'better'});
});
test('negative absolute costs rank the numerically lower cost, not the smaller absolute amount', () => {
  const c = resolveCostComparison([cost(-80), cost(-120)]);assert.deepEqual(bestCostIndices(c.signals), [1]);
});
test('equal costs retain ties, and a single reported cell is not declared best', () => {
  assert.deepEqual(bestCostIndices([cost(80), cost(80)]), [0, 1]);assert.deepEqual(bestCostIndices([cost(80), resolveCostSignal([])]), []);
});
test('partial BAU availability compares the absolute costs shared by both files', () => {
  const c = resolveCostComparison([pair(80, 100), cost(90)]);
  assert.equal(c.title, 'Cost');assert.deepEqual(c.signals.map(s=>s.primary), [80, 90]);assert.deepEqual(bestCostIndices(c.signals), [0]);
  assert.equal(c.signals[0].sourceLabel, 'district_cost_total_control_eur');
});
test('different references switch to exported absolute cost when all cells have it', () => {
  const c = resolveCostComparison([pair(80, 100), pair(90, 200)]);
  assert.deepEqual(c.signals.map(s=>s.primary), [80, 90]);assert.equal(c.title, 'Cost');assert.deepEqual(bestCostIndices(c.signals), [0]);
});
test('BAU and legacy savings do not compete under the same savings heading', () => {
  const c = resolveCostComparison([pair(80, 100), signal({cost_total_control: 90, cost_total_baseline: 100})]);
  assert.equal(c.title, 'Cost');assert.deepEqual(bestCostIndices(c.signals), [0]);
});
test('same-reference savings rank the higher saving and use a saving difference', () => {
  const c = resolveCostComparison([pair(80, 100), pair(70, 100)]);
  assert.equal(c.title, 'Cost saving vs BAU');assert.deepEqual(bestCostIndices(c.signals), [1]);
  assert.deepEqual(costComparisonDelta(c.signals[1], c.signals[0]), {value: 10, tone: 'better'});
});
test('mixed metrics remain visible and have no automatic best or delta', () => {
  const c = resolveCostComparison([cost(80), signal({cost_saving_vs_bau_eur: 20})]);
  assert.equal(c.mixedMeasures, true);assert.equal(c.comparable, false);assert.deepEqual(c.signals.map(s=>s.primary), [80,20]);
  assert.deepEqual(bestCostIndices(c.signals), []);assert.equal(costComparisonDelta(...c.signals), null);
});
test('ratios with unspecified references are visible without comparing incomparable signs', () => {
  const c = resolveCostComparison([signal({cost_ratio_to_baseline: .8}), signal({cost_ratio_to_baseline: .9})]);
  assert.equal(c.signals[0].primary, .8);assert.equal(c.comparable, false);assert.deepEqual(bestCostIndices(c.signals), []);
});
test('missing simulations do not hide the remaining reported cost values', () => {
  const c = resolveCostComparison([resolveCostSignal([]), cost(80)]);assert.equal(c.title, 'Cost');assert.equal(c.signals[1].primary, 80);
});
test('zero and negative references use the magnitude of the reference for percentages', () => {
  assert.equal(costPercent(20,-100),20);assert.equal(costPercent(-20,-100),-20);assert.equal(costPercent(20,0),null);
});
function group(labels) {
  const r=rows(labels),roles={control:[],reference:[],delta:[],ratio:[],absolute:[]};
  for(const row of r){const role=/delta|saving/.test(row.label)?'delta':/ratio/.test(row.label)?'ratio':/baseline|business_as_usual/.test(row.label)?'reference':/control/.test(row.label)?'control':'absolute';roles[role].push(row);}
  return {label:'Cost Total',rows:r,roles};
}
test('drill-down cost change and its percent have consistent signs with a negative reference',()=>{
 const g=costDrilldown(group({district_cost_total_control_eur:-120,district_cost_total_baseline_eur:-100,district_cost_ratio_to_baseline_total_ratio:1.2}));
 assert.equal(g.delta,-20);assert.equal(g.deltaPct,-20);assert.equal(g.tone,'better');
});
test('drill-down ratio-only is a ratio, zero reference has no percent and absolute cost is neutral',()=>{
 const r=costDrilldown(group({cost_ratio_to_baseline:20}));assert.equal(r.primary,20);assert.equal(r.unit,'x');assert.equal(r.deltaPct,null);
 const z=costDrilldown(group({district_cost_total_control_eur:20,district_cost_total_baseline_eur:0}));assert.equal(z.deltaPct,null);
 assert.equal(costDrilldown(group({district_cost_total_control_eur:20})).tone,'neutral');
});
test('an explicitly exported market saving keeps a positive-saving title and direction',()=>{
 const g=costDrilldown(group({district_cost_community_market_savings_total_eur:20}));assert.equal(g.primary,20);assert.equal(g.tone,'better');assert(g.label.includes('saving'));
});
test('other KPI families are not handled by the cost module',()=>assert.equal(costDrilldown(group({district_ev_departure_success_ratio:.5})),null));


test('a ratio badge follows a known negative/positive reference, and stays neutral without it', () => {
  assert.equal(signal({cost_total_baseline: -100, cost_ratio_to_baseline: 1.2}).tone, 'better');
  assert.equal(signal({cost_total_baseline: -100, cost_ratio_to_baseline: .8}).tone, 'worse');
  assert.equal(signal({cost_total_baseline: 100, cost_ratio_to_baseline: .8}).tone, 'better');
  assert.equal(signal({cost_ratio_to_baseline: .8}).tone, 'neutral');
});

// Keep the actual exporter values, including signed costs and unrelated market
// cost rows. Expected savings below are calculated from the selected raw totals.

for (const file of fs.readdirSync(new URL('./fixtures/cost-exports/', import.meta.url)).filter(f=>f.endsWith('.csv'))) {
  test(`genuine exporter cost totals reconcile with saving: ${file}`, () => {
    const csv = Papa.parse(fs.readFileSync(new URL(`./fixtures/cost-exports/${file}`, import.meta.url),'utf8'),{header:true,skipEmptyLines:true});
    for (const scope of csv.meta.fields.filter(c=>c!=='KPI')) {
      const raw = new Map(csv.data.map(r=>[r.KPI,toNumber(r[scope])])), prefix=scope==='District'?'district':'building';
      const control=raw.get(`${prefix}_cost_total_control_eur`);
      const bau=raw.get(`${prefix}_cost_total_business_as_usual_eur`), legacy=raw.get(`${prefix}_cost_total_baseline_eur`);
      const reference=Number.isFinite(bau)?bau:legacy;
      const s=resolveCostSignal([...raw].map(([label,value])=>({key:label,label,value})));
      assert.equal(s.policy,control);assert.equal(s.reference,reference);assert.equal(s.referenceSource,Number.isFinite(bau)?'bau':'baseline');
      assert(Math.abs(s.primary-(reference-control))<1e-10);
      if(reference!==0)assert(Math.abs(s.deltaPct-((reference-control)/Math.abs(reference)*100))<1e-10);
    }
  });
}
test('real cost KPI fixtures match their provenance hashes',()=>{
 const root=new URL('./fixtures/cost-exports/',import.meta.url),p=JSON.parse(fs.readFileSync(new URL('provenance.json',root)));
 for(const [file,entry]of Object.entries(p))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),entry.sha256);
});

test('drill-down recognises BAU/reference wording with supported separator variations',()=>{
 const r=[{key:'1',label:'Cost Total Control EUR',value:80},{key:'2',label:'Cost Total Business As Usual EUR',value:100}];
 const g=costDrilldown({label:'Cost Total',rows:r,roles:{control:[r[0]],reference:[r[1]],delta:[],ratio:[],absolute:[]}});
 assert.equal(g.referenceSource,'bau');assert.equal(g.delta,-20);assert.equal(g.deltaPct,-20);
 // Explicitly mark the short BAU alias as a reference as the UI's role classifier does.
 const h=group({cost_total_bau_eur:100,cost_delta_vs_bau_eur:-20});h.roles.reference=h.roles.absolute;h.roles.absolute=[];
 assert.equal(costDrilldown(h).referenceSource,'bau');
});


test('a reported ratio against a known zero reference has no parity comparison or derived percentage',()=>{
 const s=signal({cost_total_baseline:0,cost_ratio_to_baseline:2});
 assert.equal(s.primary,2);assert.equal(s.unit,'x');assert.equal(s.referenceMode,'none');assert.equal(s.deltaPct,null);assert.equal(s.comparisonDirection,'neutral');
});
