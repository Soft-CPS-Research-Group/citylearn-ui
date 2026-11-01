import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import {createHash} from 'node:crypto';
import {toNumber} from '../src/results/values.js';
import {resolveEvService, comparableEvSignals, evComparison, bestEvIndices, evComparisonDelta, evDrilldownUnit} from '../src/results/ev-service.js';
const MIN='ev-min-feasible',TOL='ev-within-tolerance';
const rows=metrics=>Object.entries(metrics).map(([label,value])=>({key:label,label,value}));
const ev=(metrics,id=MIN)=>resolveEvService(rows(metrics),id);
function audited(rate=1,threshold='min_acceptable',overrides={}){
 return {district_ev_departure_audit_departures_count:4,district_ev_departure_audit_service_observed_count:4,
 district_ev_departure_audit_service_unknown_count:0,[`district_ev_departure_audit_${threshold}_feasible_count`]:4,
 [`district_ev_departure_audit_${threshold}_infeasible_count`]:0,[`district_ev_departure_audit_${threshold}_unknown_count`]:0,
 [`district_ev_departure_audit_${threshold}_feasible_service_observed_count`]:4,
 [`district_ev_departure_audit_${threshold}_feasible_service_met_count`]:rate*4,
 [`district_ev_departure_audit_${threshold}_service_feasible_ratio`]:rate,...overrides};
}

test('a general 50% rate never becomes feasible service when the feasible rate is null',()=>{
 const s=ev({district_ev_performance_departure_min_acceptable_feasible_ratio:null,district_ev_performance_departure_min_acceptable_ratio:.5});
 assert.equal(s.primary,.5);assert.equal(s.basis,'legacy-all');assert(s.title.includes('counted departures'));assert(!s.title.includes('feasible'));
});
test('the modern audit takes precedence with its observed-feasible denominator',()=>{
 const s=ev(audited(.5,'min_acceptable',{district_ev_performance_departure_min_acceptable_feasible_ratio:1}));
 assert.equal(s.primary,.5);assert.equal(s.basis,'audit-feasible');assert.equal(s.denominator,4);assert.equal(s.numerator,2);
 assert.equal(s.title,'EV minimum service — feasible, observed');assert(s.evidence.some(t=>t==='Service met: 2/4.'));
});
test('legacy feasible denominator is a feasible count, not a count of successful departures',()=>{
 const s=ev({district_ev_performance_departure_min_acceptable_feasible_ratio:1,district_ev_events_departure_min_acceptable_feasible_count:631,district_ev_events_departure_min_acceptable_count:633,district_ev_events_departure_count:636});
 assert.equal(s.denominator,631);assert.equal(s.numerator,null);assert.equal(s.basis,'legacy-feasible');assert(s.evidence.includes('Coverage not reported.'));
});
test('strict target success is identified separately from minimum acceptable service',()=>{
 const s=ev({district_ev_performance_departure_success_ratio:0,district_ev_events_departure_count:14,district_ev_events_departure_met_count:0});
 assert.equal(s.primary,0);assert.equal(s.criterion,'target');assert(s.title.startsWith('EV target reached'));assert.equal(s.denominator,14);assert.equal(s.numerator,0);
});
test('within-tolerance fallback identifies all counted departures instead of feasible ones',()=>{
 const s=ev({district_ev_performance_departure_within_tolerance_ratio:.286,district_ev_events_departure_count:14,district_ev_events_departure_within_tolerance_count:4},TOL);
 assert.equal(s.primary,.286);assert.equal(s.basis,'legacy-all');assert.equal(s.denominator,14);assert(!s.inconsistent);
});
test('an ambiguous historical rate is still visible, with its denominator unspecified',()=>{
 const s=ev({ev_within_tolerance_rate:.5},TOL);assert.equal(s.primary,.5);assert.equal(s.basis,'unspecified');
 assert.equal(s.comparisonDirection,'neutral');assert.equal(s.tone,'neutral');assert(s.evidence[0].includes('unspecified denominator'));
});
for(const [id,threshold]of [[MIN,'min_acceptable'],[TOL,'within_tolerance']]){
 for(const value of [0,.25,.5,1])test(`${threshold} preserves an actual ${value*100}% audited service rate`,()=>{
  const s=ev(audited(value,threshold),id);assert.equal(s.primary,value);assert.equal(s.status,'reported');assert.equal(s.reported,true);
 });
}
test('known zero departures are not a failed 0% service rate',()=>{
 const s=ev(audited(0,'min_acceptable',{district_ev_departure_audit_departures_count:0,district_ev_departure_audit_service_observed_count:0,district_ev_departure_audit_min_acceptable_feasible_count:0,district_ev_departure_audit_min_acceptable_feasible_service_observed_count:0}));
 assert.equal(s.primary,null);assert.equal(s.status,'not-applicable');assert.equal(s.statusLabel,'No departures');assert.equal(s.exportedValue,0);
 assert(!s.evidence.join(' ').includes('/0'));
});
test('explicit absence of EVs differs from EVs with no departures',()=>{
 const noEv=ev({district_ev_vehicle_count:0,district_ev_events_departure_count:0});
 const noDeparture=ev({district_ev_vehicle_count:2,district_ev_events_departure_count:0});
 assert.equal(noEv.statusLabel,'No EVs');assert.equal(noDeparture.statusLabel,'No departures');assert.equal(noEv.primary,null);assert.equal(noDeparture.primary,null);
});
test('zero counted departures alone never asserts that no EV equipment exists',()=>{
 assert.equal(ev({district_ev_events_departure_count:0}).statusLabel,'No departures');
});
test('a zero feasible denominator with observed service does not become 0% or fall back to optimistic legacy data',()=>{
 const s=ev(audited(null,'min_acceptable',{district_ev_departure_audit_min_acceptable_feasible_count:0,district_ev_departure_audit_min_acceptable_infeasible_count:4,district_ev_departure_audit_min_acceptable_feasible_service_observed_count:0,district_ev_departure_audit_min_acceptable_feasible_service_met_count:0,district_ev_performance_departure_min_acceptable_feasible_ratio:1}));
 assert.equal(s.primary,null);assert.equal(s.statusLabel,'No evaluable departures');assert.equal(s.basis,'audit-feasible');
});
test('an observed-departure alternative keeps its real basis when none are known feasible',()=>{
 const s=ev(audited(null,'min_acceptable',{district_ev_departure_audit_min_acceptable_feasible_count:0,district_ev_departure_audit_min_acceptable_infeasible_count:4,district_ev_departure_audit_min_acceptable_feasible_service_observed_count:0,district_ev_departure_audit_min_acceptable_feasible_service_met_count:0,district_ev_departure_audit_min_acceptable_service_observed_ratio:.5,district_ev_departure_audit_min_acceptable_service_met_count:2}));
 assert.equal(s.primary,.5);assert.equal(s.basis,'audit-observed');assert.equal(s.denominator,4);assert(s.title.includes('observed departures'));
});
test('unobserved service remains unknown rather than a successful or failed departure',()=>{
 const s=ev(audited(null,'min_acceptable',{district_ev_departure_audit_service_observed_count:0,district_ev_departure_audit_service_unknown_count:4,district_ev_departure_audit_min_acceptable_feasible_count:0,district_ev_departure_audit_min_acceptable_unknown_count:4,district_ev_departure_audit_min_acceptable_feasible_service_observed_count:0,district_ev_departure_audit_min_acceptable_feasible_service_met_count:0,district_ev_performance_departure_min_acceptable_ratio:1}));
 assert.equal(s.primary,null);assert.equal(s.statusLabel,'Service unknown');assert(s.partial);assert(s.evidence.some(t=>t.includes('4 unknown')));
});
test('100% of one evaluable departure with seven unknown departures is not full-coverage success',()=>{
 const s=ev(audited(1,'min_acceptable',{district_ev_departure_audit_departures_count:8,district_ev_departure_audit_service_observed_count:1,district_ev_departure_audit_service_unknown_count:7,district_ev_departure_audit_min_acceptable_feasible_count:1,district_ev_departure_audit_min_acceptable_unknown_count:7,district_ev_departure_audit_min_acceptable_feasible_service_observed_count:1,district_ev_departure_audit_min_acceptable_feasible_service_met_count:1}));
 assert.equal(s.primary,1);assert.equal(s.denominator,1);assert.equal(s.serviceCoverage,.125);assert(s.partial);assert.equal(s.tone,'neutral');assert.deepEqual(bestEvIndices([s,ev(audited(.5))]),[]);
});
test('missing counts preserve older exports, with coverage explicitly unavailable',()=>{
 const s=ev({building_ev_performance_departure_min_acceptable_feasible_ratio:.5});assert.equal(s.primary,.5);assert.equal(s.denominator,null);assert(s.evidence.includes('Coverage not reported.'));
});
for(const value of [null,undefined,NaN,Infinity,-Infinity])test(`a missing/non-finite rate (${value}) is not zero`,()=>{
 const s=ev({ev_min_acceptable_feasible_rate:value});assert.equal(s.primary,null);assert.equal(s.reported,false);
});
for(const value of [-.1,1.1,50])test(`invalid exported fraction ${value} is not silently reinterpreted as a percentage`,()=>{
 const s=ev({ev_min_acceptable_feasible_rate:value});assert.equal(s.primary,null);assert.equal(s.exportedValue,value);assert.equal(s.statusLabel,'Invalid exported rate');
});
test('counts with impossible numerators retain the reported value but suppress positive judgements',()=>{
 const s=ev(audited(1,'min_acceptable',{district_ev_departure_audit_min_acceptable_feasible_service_met_count:5}));
 assert.equal(s.primary,1);assert(s.inconsistent);assert.equal(s.tone,'neutral');assert(s.evidence.some(t=>t.includes('Inconsistent')));
});
for(const value of [-1,1.5])test(`invalid count ${value} never enables an automatic success claim`,()=>{
 const s=ev(audited(1,'min_acceptable',{district_ev_departure_audit_min_acceptable_feasible_service_observed_count:value}));assert(s.inconsistent);assert.equal(s.tone,'neutral');
});
test('a target threshold, unknown-reason count or SOC tolerance parameter cannot be mistaken for a service rate',()=>{
 const s=ev({district_ev_performance_departure_tolerance_ratio:.05,district_ev_departure_audit_min_acceptable_unknown_missing_target_count:3});assert.equal(s.primary,null);
});
test('incomplete counts that are available remain visible even without a total',()=>{
 const s=ev({ev_min_acceptable_feasible_rate:.5,district_ev_departure_audit_service_observed_count:2,district_ev_departure_audit_service_unknown_count:3});
 assert(s.evidence.some(t=>t.includes('Service observed: 2')));assert(s.evidence.some(t=>t.includes('Service unknown: 3')));
});
test('comparison refuses to mix all, feasible, observed and legacy denominators',()=>{
 const general=ev({district_ev_performance_departure_min_acceptable_ratio:.5});const feasible=ev({ev_min_acceptable_feasible_rate:1});const modern=ev(audited(1));
 for(const pair of [[general,feasible],[feasible,modern],[general,modern]]){assert(!comparableEvSignals(pair));assert.deepEqual(bestEvIndices(pair),[]);assert.equal(evComparisonDelta(...pair),null);assert(evComparison(pair,MIN).mixedMeasures);}
});
test('strict target success and minimum acceptable service do not share a comparison',()=>{
 const a=ev({district_ev_performance_departure_success_ratio:1}),b=ev({district_ev_performance_departure_min_acceptable_ratio:1});assert.equal(comparableEvSignals([a,b]),false);
});
test('same-basis rates remain comparable, with differences labelled in percentage points',()=>{
 const a=ev(audited(1)),b=ev(audited(.5));assert(comparableEvSignals([a,b]));assert.deepEqual(bestEvIndices([a,b]),[0]);assert.deepEqual(evComparisonDelta(a,b),{points:50,tone:'better'});
});
test('unspecified rates, partial coverage, missing values and single reported cells have no automatic winner',()=>{
 const s=ev({ev_within_tolerance_rate:1},TOL);assert.deepEqual(bestEvIndices([s,s]),[]);assert.deepEqual(bestEvIndices([ev(audited(1)),ev({})]),[]);
});
test('historical same-basis exports remain comparable without demanding new manifests or counters',()=>{
 const a=ev({ev_min_acceptable_feasible_rate:.5}),b=ev({ev_min_acceptable_feasible_rate:1});assert(comparableEvSignals([a,b]));assert.deepEqual(bestEvIndices([a,b]),[1]);
});
test('audited target-only exports are labelled target success rather than minimum service',()=>{
 const s=ev(audited(.5,'target'));assert.equal(s.criterion,'target');assert.equal(s.basis,'audit-feasible');assert.equal(s.denominator,4);assert(s.title.startsWith('EV target reached'));
});

test('observed-feasible service cannot have more evaluable departures than feasible or observed ones',()=>{
 const s=ev(audited(1,'min_acceptable',{district_ev_departure_audit_min_acceptable_feasible_service_observed_count:5,district_ev_departure_audit_min_acceptable_feasible_service_met_count:5}));
 assert(s.inconsistent);assert.equal(s.tone,'neutral');
});

for(const file of fs.readdirSync(new URL('./fixtures/ev-exports/',import.meta.url)).filter(f=>f.endsWith('.csv'))){
 test(`genuine exporter preserves its EV denominator and values: ${file}`,()=>{
  const parsed=Papa.parse(fs.readFileSync(new URL(`./fixtures/ev-exports/${file}`,import.meta.url),'utf8'),{header:true,skipEmptyLines:true});
  const scopes=parsed.meta.fields.filter(c=>c!=='KPI');
  for(const scope of scopes){
   const r=parsed.data.map(x=>({key:x.KPI,label:x.KPI,value:toNumber(x[scope])}));
   for(const id of [MIN,TOL]){
    const s=resolveEvService(r,id),prefix=scope==='District'?'district':'building';
    const raw=new Map(r.map(x=>[x.label,x.value]));
    if(file.startsWith('cps-')){
     assert.equal(s.basis,'audit-feasible');assert.equal(s.denominator,raw.get(`${prefix}_ev_departure_audit_${id===MIN?'min_acceptable':'within_tolerance'}_feasible_service_observed_count`));
     if(s.denominator>0)assert.equal(s.primary,raw.get(`${prefix}_ev_departure_audit_${id===MIN?'min_acceptable':'within_tolerance'}_service_feasible_ratio`));
    }else if(file==='citylearn.csv'){
     assert.equal(s.basis,'legacy-all');assert.equal(s.criterion,id===MIN?'target':'tolerance');
     assert.equal(s.primary,raw.get(`${prefix}_ev_performance_departure_${id===MIN?'success':'within_tolerance'}_ratio`));
    }else{assert.equal(s.basis,'legacy-feasible');assert.equal(s.primary,raw.get(`${prefix}_ev_performance_departure_${id===MIN?'min_acceptable':'within_tolerance'}_feasible_ratio`));}
    assert(!s.inconsistent,`${file}/${scope}/${id}`);
   }
  }
 });
}
test('real EV fixtures preserve their recorded hashes',()=>{
 const root=new URL('./fixtures/ev-exports/',import.meta.url),provenance=JSON.parse(fs.readFileSync(new URL('provenance.json',root)));
 for(const [file,data]of Object.entries(provenance))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'),data.sha256);
});

test('coverage ratios remain visible when the corresponding counts are not exported',()=>{
 const s=ev({ev_min_acceptable_feasible_rate:1,district_ev_departure_audit_service_coverage_ratio:.5});
 assert(s.partial);assert(s.evidence.some(t=>t.includes('Service coverage: 50%')));assert(!s.evidence.includes('Coverage not reported.'));
});
test('a reported zero rate is displayed without a negative-zero artefact',()=>{
 const s=ev({ev_min_acceptable_feasible_rate:-0});assert.equal(s.primary,0);assert(!Object.is(s.primary,-0));
});

test('observed-departure rates do not require an unrelated feasibility coverage to be complete',()=>{
 const s=ev(audited(null,'min_acceptable',{district_ev_departure_audit_min_acceptable_feasible_count:0,district_ev_departure_audit_min_acceptable_unknown_count:4,district_ev_departure_audit_min_acceptable_feasible_service_observed_count:0,district_ev_departure_audit_min_acceptable_service_observed_ratio:1,district_ev_departure_audit_min_acceptable_service_met_count:4}));
 assert.equal(s.basis,'audit-observed');assert.equal(s.primary,1);assert(s.feasibilityPartial);assert(!s.partial);assert.equal(s.tone,'better');
});


test('the raw EV KPI table labels unscaled service and coverage ratios as fractions, not percentages',()=>{
 assert.equal(evDrilldownUnit(rows({district_ev_performance_departure_min_acceptable_feasible_ratio:.5})),'fraction');
 assert.equal(evDrilldownUnit(rows({district_ev_departure_audit_service_coverage_ratio:.5})),'fraction');
 assert.equal(evDrilldownUnit(rows({ev_within_tolerance_rate:.5})),'fraction');
 assert.equal(evDrilldownUnit(rows({district_ev_events_departure_count:2})),null);
 assert.equal(evDrilldownUnit(rows({district_cost_ratio_to_baseline_total_ratio:.5})),null);
});


test('a missing service metric does not invent a legacy or feasible denominator',()=>{
 const s=ev({});assert.equal(s.primary,null);assert.equal(s.title,'EV minimum service');assert.equal(s.basis,'unspecified');
 assert(s.evidence.includes('Denominator not reported.'));assert(!s.description.includes('legacy'));
});


test('partial modern exports can use an available general legacy rate, with its real denominator',()=>{
 const s=ev(audited(null,'min_acceptable',{district_ev_departure_audit_min_acceptable_feasible_count:0,district_ev_departure_audit_min_acceptable_infeasible_count:4,district_ev_departure_audit_min_acceptable_feasible_service_observed_count:0,district_ev_performance_departure_min_acceptable_feasible_ratio:1,district_ev_performance_departure_min_acceptable_ratio:.5,district_ev_events_departure_count:4,district_ev_events_departure_min_acceptable_count:2}));
 assert.equal(s.primary,.5);assert.equal(s.basis,'legacy-all');assert.equal(s.denominator,4);assert(!s.title.includes('feasible'));
});
