import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';
import {createHash} from 'node:crypto';
import {buildEquipmentTree, classifySeries} from '../src/results/equipment.js';
import {getEquipmentChartConfig} from '../src/results/chart-config.js';
import {aggregateRowsForChart, aggregateChartGroup, inferAggregation} from '../src/results/aggregation.js';
import {toNumber} from '../src/results/values.js';

const headers = {
  building: ['Net Electricity Consumption-kWh', 'Non-shiftable Load-kWh', 'Energy Production from PV-kWh'],
  battery: ['Battery Soc-%', 'Battery (Dis)Charge-kWh'],
  charger: ['Charger Consumption-kWh', 'Charger Production-kWh', 'EV SOC-%', 'EV Charger State'],
  ev: ['name', 'Battery capacity', 'electric_vehicle_soc'],
  pricing: ['electricity_pricing-$/kWh'],
  pv: ['Energy Production from PV-kWh'],
  unknown: ['sensor_energy_kwh', 'power_kw', 'soc', 'price_eur_per_kwh', 'extra_energy_kwh']
};
function series(key, type, overrides = {}) {
  const columns = headers[type] || [];
  return {id: key, resultKey: key.toLowerCase(), relativePath: `exported_data_${key}_ep0.csv`,
    label: key, episode: 'ep0', columns, rows: [], numericColumns: columns, ...overrides};
}
function flatten(tree) {
  return [...tree.buildings.flatMap(b => [...b.items, ...b.chargers, ...b.batteries]), ...tree.vehicles, ...tree.pricing, ...tree.other];
}
function readExports(name) {
  const root = new URL(`./fixtures/exports/${name}/`, import.meta.url);
  return fs.readdirSync(root).filter(n => n.endsWith('.csv')).map(file => {
    const parsed = Papa.parse(fs.readFileSync(new URL(file, root), 'utf8'), {header: true, skipEmptyLines: true});
    const columns = parsed.meta.fields;
    return {id: file, fileName: file, relativePath: file, resultKey: file.replace(/^exported_data_/, '').replace(/\.csv$/, '').toLowerCase(),
      label: file, rows: parsed.data, columns, numericColumns: columns.filter(c => c !== 'timestamp' && parsed.data.some(r => toNumber(r[c]) !== null)),
      timeKey: 'timestamp', episode: 'ep0'};
  });
}

for (const id of ['Building_1', 'Member_001', 'Casa-Norte', 'αθήνα', 'Sítio.42', 'Plant/Zone A']) {
  test(`equipment types and host relation do not require a building name convention: ${id}`, () => {
    const input = [series(`${id}_plug-special`, 'charger'), series(`${id}_battery`, 'battery'), series(id, 'building'),
      series('Road vehicle 7', 'ev', {rows: [{name: 'Road vehicle 7'}]}), series('tariff-any-name', 'pricing')];
    const tree = buildEquipmentTree({series: input}, 'ep0');
    assert.equal(tree.buildings.length, 1);
    assert.equal(tree.buildings[0].chargers.length, 1);
    assert.equal(tree.buildings[0].batteries.length, 1);
    assert.equal(tree.buildings[0].entityId, id.split('/').pop());
    assert.equal(tree.buildings[0].chargers[0].buildingId, tree.buildings[0].id);
    assert.equal(tree.vehicles[0].label, 'Road vehicle 7');
    assert.equal(tree.pricing.length, 1);
    assert.equal(tree.other.length, 0);
  });
}
for (const [name, buildings, vehicles, chargers] of [['cps', 4, 2, 2], ['citylearn', 17, 8, 8]]) {
  test(`${name} genuine exports retain every series and classify equipment`, () => {
    const input = readExports(name), tree = buildEquipmentTree({series: input}, 'ep0');
    assert.equal(tree.buildings.length, buildings);
    assert.equal(tree.vehicles.length, vehicles);
    assert.equal(tree.buildings.reduce((n, b) => n + b.chargers.length, 0), chargers);
    assert.equal(tree.buildings.reduce((n, b) => n + b.batteries.length, 0), buildings);
    assert.equal(tree.other.length, 0);
    const items = flatten(tree);
    const seen = new Set(items.map(i => i.series.id));
    const explicitCommunity = input.filter(s => classifySeries(s).type === 'community');
    assert.equal(seen.size + explicitCommunity.length, input.length);
    for (const item of items) {
      const config = getEquipmentChartConfig(item);
      assert(config.series.some(s => s.field), item.series.fileName);
      assert(input.includes(item.series)); // Original columns, IDs and values are retained.
    }
  });
}

test('legacy charger-only and battery-only folders remain organised', () => {
  const t = buildEquipmentTree({series: [series('building_15_charger_15_2', 'charger'), series('building_15_battery', 'battery')]}, 'ep0');
  assert.equal(t.buildings[0].label, 'Building 15');
  assert.equal(t.buildings[0].chargers[0].label, 'Charger 2');
  assert.equal(t.buildings[0].batteries.length, 1);
});
test('case and punctuation are preserved; KPI identity can restore exporter filename casing', () => {
  const t = buildEquipmentTree({series: [series('member_001', 'building')], kpis: {labelKey: 'KPI', columns: ['KPI', 'District', 'Member_001']}}, 'ep0');
  assert.equal(t.buildings[0].entityId, 'Member_001');
  assert.equal(t.buildings[0].label, 'Member_001');
});
test('equipment order does not affect host lookup; numeric prefixes are not confused', () => {
  const input = [series('building_10_custom', 'charger'), series('building_1_custom', 'charger'), series('building_10', 'building'), series('building_1', 'building')];
  for (const rows of [input, input.toReversed()]) {
    const t = buildEquipmentTree({series: rows}, 'ep0');
    assert.equal(t.buildings.length, 2);
    assert(t.buildings.every(b => b.chargers.length === 1));
    assert(t.buildings.every(b => b.chargers[0].series.id.startsWith(b.id + '_')));
  }
});
test('ambiguous parents leave assets visible with the correct equipment chart', () => {
  const t = buildEquipmentTree({series: [series('North', 'building'), series('North_Wing', 'building'), series('North_Wing_plug', 'charger')]}, 'ep0');
  assert.equal(t.other.length, 1);
  assert.equal(t.other[0].type, 'charger');
  assert.equal(t.other[0].buildingId, null);
  assert.equal(getEquipmentChartConfig(t.other[0]).kind, 'Charger');
});
test('explicit identity and host metadata resolve ambiguous filenames', () => {
  const rows = [series('North', 'building'), series('North_Wing', 'building'), series('Unrelated', 'charger', {entity: {id: 'Plug-α', type: 'charger', buildingId: 'North_Wing'}})];
  const t = buildEquipmentTree({series: rows}, 'ep0');
  assert.equal(t.buildings.find(b => b.id === 'North_Wing').chargers[0].label, 'Plug-α');
  assert.equal(t.other.length, 0);
});
test('explicit parent is usable even without a building timeseries', () => {
  const t = buildEquipmentTree({series: [series('sensor', 'battery', {entity: {type: 'battery', id: 'BESS-1', buildingId: 'Factory-2'}})]}, 'ep0');
  assert.equal(t.buildings[0].entityId, 'Factory-2');
  assert.equal(t.buildings[0].batteries.length, 1);
});
test('orphan battery and arbitrary unknown series remain accessible', () => {
  const t = buildEquipmentTree({series: [series('unattached', 'battery'), series('my-new-device', 'unknown')]}, 'ep0');
  assert.equal(t.other.length, 2);
  assert.equal(t.other.find(i => i.type === 'generic').series.id, 'my-new-device');
  const c = getEquipmentChartConfig(t.other.find(i => i.type === 'generic'));
  assert.equal(c.series.length, 5);
  assert.equal(c.series.filter(s => s.visible).length, 4);
  assert.equal(c.series[4].field, 'extra_energy_kwh');
});
test('episode selection includes common series without mixing other episodes', () => {
  const t = buildEquipmentTree({series: [series('home', 'building'), series('home', 'building', {id: 'ep1', episode: 'ep1'}), series('tariff', 'pricing', {episode: ''})]}, 'ep1');
  assert.equal(t.buildings[0].items[0].series.id, 'ep1');
  assert.equal(t.pricing.length, 1);
});
test('baseline long/multi-entity timeseries stays generic rather than becoming a building', () => {
  const s = series('business_as_usual', 'building');
  assert.equal(classifySeries(s).type, 'generic');
});
test('community column signature is recognised with a custom filename', () => {
  assert.equal(classifySeries(series('REC-A', null, {columns: ['Net Electricity Consumption-kWh', 'Self Consumption-kWh', 'Total Solar Generation-kWh']})).type, 'community');
});

for (const [column, expected] of [
  ['Energy-kWh', 'sum'], ['sensor_energy_kwh', 'sum'], ['delivered Wh', 'sum'], ['Generated_MWh', 'sum'],
  ['net_electricity_consumption', 'sum'], ['solar_generation', 'sum'], ['battery_charge', 'sum'],
  ['power_kw', 'avg'], ['electricity_pricing-$/kWh', 'avg'], ['price_eur_per_kwh', 'avg'],
  ['carbon_kg_per_kwh', 'avg'], ['SOC-%', 'avg'], ['temperature_C', 'avg'], ['unknown', 'avg'],
  ['capacity_kwh', 'last'], ['stored_energy_kwh', 'last'], ['cumulative_energy_kwh', 'last'], ['EV Charger State', 'last']
]) test(`aggregation respects the quantity of ${column}`, () => assert.equal(inferAggregation(column), expected));

test('explicit quantity/unit/aggregation take precedence over name inference', () => {
  assert.equal(inferAggregation('unknown', {unit: 'kWh'}), 'sum');
  assert.equal(inferAggregation('energy_kwh', {unit: 'kW'}), 'avg');
  assert.equal(inferAggregation('energy_kwh', {quantity: 'stock'}), 'last');
  assert.equal(inferAggregation('price', {quantity: 'interval_energy'}), 'sum');
  assert.equal(inferAggregation('energy_kwh', {aggregation: 'avg'}), 'avg');
});
test('real CPS quarter-hour consumption sums to the hourly meter total', () => {
  const s = readExports('cps').find(s => s.fileName === 'exported_data_member_001_ep0.csv');
  const rows = s.rows.slice(0, 4).map(r => ({...r, timestamp: Date.parse(r.timestamp)}));
  const key = 'Non-shiftable Load-kWh';
  const expected = 0.23423836380243301;
  for (const type of ['generic', 'consumption']) {
    const actual = aggregateRowsForChart(rows, 60, getEquipmentChartConfig({type, series: s}).series)[0][key];
    assert(Math.abs(actual - expected) < 1e-12);
  }
});
for (const name of ['cps', 'citylearn']) test(`${name} energy totals survive all chart granularities`, () => {
  const t = buildEquipmentTree({series: readExports(name)}, 'ep0');
  for (const item of flatten(t)) {
    const config = getEquipmentChartConfig(item);
    const rows = item.series.rows.map(r => ({...r, timestamp: Date.parse(r.timestamp)}));
    for (const s of config.series.filter(c => c.field && c.strategy === 'sum')) {
      const base = aggregateRowsForChart(rows, 1, [s]).reduce((n, r) => n + (r[s.field] ?? 0), 0);
      for (const minutes of [15, 60, 180, 360, 1440]) {
        const total = aggregateRowsForChart(rows, minutes, [s]).reduce((n, r) => n + (r[s.field] ?? 0), 0);
        assert(Math.abs(base - total) < 1e-8, `${item.series.fileName}: ${s.field}, ${minutes}min`);
      }
    }
  }
});
test('generic chart sums signed energy, averages power/SOC/price and retains stock', () => {
  const s = series('unknown', 'unknown');
  s.columns.push('capacity_kwh');s.numericColumns.push('capacity_kwh');
  const configs = getEquipmentChartConfig({type: 'generic', series: s}).series;
  const rows = [1, 2, 3, 4].map((n, i) => ({timestamp: i * 900000, sensor_energy_kwh: i % 2 ? -n : n,
    power_kw: n, soc: n / 10, price_eur_per_kwh: n / 100, capacity_kwh: 10 + n}));
  const r = aggregateRowsForChart(rows, 60, configs)[0];
  assert.equal(r.sensor_energy_kwh, -2);assert.equal(r.power_kw, 2.5);assert.equal(r.soc, .25);assert.equal(r.price_eur_per_kwh, .025);assert.equal(r.capacity_kwh, 14);
});
test('battery and charger signed terminal energies retain their existing conventions', () => {
  const battery = getEquipmentChartConfig({type: 'battery', series: series('b', 'battery')});
  const b = aggregateChartGroup(0, [{'Battery (Dis)Charge-kWh': 2, 'Battery Soc-%': .5}, {'Battery (Dis)Charge-kWh': -1, 'Battery Soc-%': .7}], battery.series);
  assert.equal(b.__battery_charge, 2);assert.equal(b.__battery_discharge, -1);assert.equal(b['Battery Soc-%'], 60);
  const charger = getEquipmentChartConfig({type: 'charger', series: series('c', 'charger')});
  const c = aggregateChartGroup(0, [{'Charger Consumption-kWh': 2, 'Charger Production-kWh': -1}, {'Charger Consumption-kWh': -1, 'Charger Production-kWh': 1}], charger.series);
  assert.equal(c.__charger_net, 1);
});
test('unknown, missing and zero are not interchanged by aggregation', () => {
  const c = [{field: 'energy_kwh', strategy: 'sum'}];
  assert.equal(aggregateChartGroup(0, [{energy_kwh: null}, {energy_kwh: ''}], c).energy_kwh, null);
  assert.equal(aggregateChartGroup(0, [{energy_kwh: 0}], c).energy_kwh, 0);
});


test('extra self-consumption columns do not turn a building into a community', () => {
  const s = series('Home-A', 'building', {columns: [...headers.building, 'Self Consumption-kWh', 'Total Solar Generation-kWh']});
  assert.equal(classifySeries(s).type, 'building');
});
test('filename directory names and duplicate IDs in different directories stay scoped', () => {
  const t = buildEquipmentTree({series: [series('exported_data_run/Building_1', 'building'), series('other/Building_1', 'building'),
    series('exported_data_run/Building_1_plug', 'charger'), series('other/Building_1_plug', 'charger')]}, 'ep0');
  assert.equal(t.buildings.length, 2);
  assert(t.buildings.every(b => b.chargers.length === 1));
  assert.notEqual(t.buildings[0].id, t.buildings[1].id);
});
test('genuine export excerpts match their recorded provenance hashes', () => {
  const provenance = JSON.parse(fs.readFileSync(new URL('./fixtures/exports/provenance.json', import.meta.url)));
  for (const [family, record] of Object.entries(provenance)) {
    for (const [file, expected] of Object.entries(record.files)) {
      const bytes = fs.readFileSync(new URL(`./fixtures/exports/${family}/${file}`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
    }
  }
});

test('explicit CSV host column links equipment with unrelated filenames', () => {
  const host = series('Home_N', 'building');
  const device = series('Asset_93', 'charger', {columns: [...headers.charger, 'building_id'], rows: [{building_id: 'Home_N'}]});
  const t = buildEquipmentTree({series: [device, host]}, 'ep0');
  assert.equal(t.buildings[0].chargers[0].series.id, 'Asset_93');
  assert.equal(t.other.length, 0);
});


test('numeric zero is a valid explicit equipment/building identity', () => {
  const t = buildEquipmentTree({series: [series('home', 'building', {entity: {type: 'building', id: 0}}),
    series('plug', 'charger', {entity: {type: 'charger', id: 0, buildingId: 0}})]}, 'ep0');
  assert.equal(t.buildings[0].entityId, '0');
  assert.equal(t.buildings[0].chargers[0].label, '0');
});
test('unknown type names never resolve to inherited object properties', () => {
  assert.equal(classifySeries(series('asset', null, {entity: {type: 'constructor'}})).type, 'generic');
});
