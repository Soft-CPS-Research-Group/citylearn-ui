import {reconstructCommunity} from '../src/results/community.js';
import {buildEquipmentTree} from '../src/results/equipment.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {readTable,readPartitions} from '../src/results/tabular.js';
import {parseResultFolder,groupResultFiles,parseResultGroups} from '../src/results/import.js';
import {SOURCE,EXCLUDED,SIGNAL_COVERAGE,analyzeTable,chartCoverage,valueState,declaredIntervalMs} from '../src/results/quality.js';
import {prepareTimeline} from '../src/results/temporal.js';
import {aggregateRowsForChart,aggregateChartGroup} from '../src/results/aggregation.js';
import {getEquipmentChartConfig} from '../src/results/chart-config.js';
const file=(name,text,folder='run')=>({name,webkitRelativePath:folder+'/'+name,size:text.length,lastModified:0,text:async()=>text,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
const entry=f=>({file:f,fileName:f.name,relativePath:f.webkitRelativePath});
const table=text=>readTable(entry(file('data.csv',text)));
const parse=files=>parseResultFolder(groupResultFiles(files)[0]);
const kpi=text=>file('exported_kpis.csv',text);
const ENERGY='Net Electricity Consumption-kWh',LOAD='Non-shiftable Load-kWh';
const asset=text=>file('exported_data_A_ep0.csv',`timestamp,${ENERGY},${LOAD}\n`+text);

test('extra CSV fields have exact source record, visible extra values and isolated calculations',async()=>{
 const s=await parse([asset('2023-01-01T00:00Z,1,1\n2023-01-01T00:15Z,100,100,extra\n2023-01-01T00:30Z,3,3\n')]);
 const a=s.series[0];assert.equal(a.rows.length,3);assert.equal(prepareTimeline(a).rows.length,2);assert.equal(a.rows[1][EXCLUDED],true);assert.deepEqual(a.rows[1]['(extra fields)'],['extra']);
 const d=s.quality.diagnostics.find(d=>d.code==='field-count');assert.equal(d.record,2);assert.equal(d.file,a.fileName);assert(d.impact.includes('excluded'));
 assert.equal(aggregateRowsForChart(prepareTimeline(a).rows,60,[{field:ENERGY,strategy:'sum'}])[0][ENERGY],4);
});
test('short CSV records remain in source, with other well-formed records usable',async()=>{
 const t=await table('timestamp,kwh,note\n2023-01-01,1,ok\n2023-01-02,2\n');assert.equal(t.rows[1][EXCLUDED],true);assert.equal(t.rows[1].kwh,'2');assert.equal(t.rows[1].note,undefined);
});
test('quoted multiline cells and delimiters keep logical record identities',async()=>{
 const t=await table('timestamp,note,energy_kwh\n2023-01-01,"hello\nthere, friend",1\n2023-01-02,ok,2,extra\n');
 assert.equal(t.rows.length,2);assert.equal(t.rows[0].note,'hello\nthere, friend');assert.equal(t.rows[1][SOURCE].record,2);assert.equal(t.diagnostics.find(d=>d.code==='field-count').record,2);
});
test('malformed quoting is retained as original text and does not become a measured zero',async()=>{
 const t=await table('timestamp,energy_kwh\n2023-01-01,"1\n2023-01-02,2');assert(t.diagnostics.some(d=>d.code.startsWith('csv-')));assert(t.rawText.includes('2023-01-02,2'));assert(t.rows.some(row=>row[EXCLUDED]));
});
for(const header of ['x,x','x,',' ,x'])test(`invalid headers preserve both original positions: ${header}`,async()=>{
 const t=await table(header+'\n1,2\n');assert(t.headerInvalid);assert.equal(new Set(t.columns).size,2);assert.equal(t.rows[0][t.columns[0]],'1');assert.equal(t.rows[0][t.columns[1]],'2');assert.equal(t.rawText,header+'\n1,2\n');assert(t.rows[0][EXCLUDED]);
});
test('inspection labels do not collide with existing header names',async()=>{
 const t=await table('a,a,"a (column 2, 2)"\n1,2,3\n');assert.equal(new Set(t.columns).size,3);assert.equal(Object.values(t.rows[0]).length,3);
});
test('single-column tables remain supported without treating delimiter fallback as corruption',async()=>{
 const t=await table('energy_kwh\n0\n2\n');assert.equal(t.rows.length,2);assert(!t.rows.some(r=>r[EXCLUDED]));assert.equal(t.rows[0].energy_kwh,'0');
});
for(const text of ['', 'timestamp,energy_kwh\n'])test(`empty file/table explicitly reports no records: ${text.length}`,async()=>{
 const t=await table(text);assert.equal(t.rows.length,0);assert(t.diagnostics.some(d=>d.code==='empty-table'));
});
test('NaN, missing, infinity, text and genuine zero are distinct',()=>{
 assert.equal(valueState(null),'missing');assert.equal(valueState(''),'missing');assert.equal(valueState('N/A'),'missing');assert.equal(valueState('NaN'),'invalid');assert.equal(valueState(Infinity),'invalid');assert.equal(valueState('oops'),'invalid');assert.equal(valueState(0),'valid');assert.equal(valueState(-1),'valid');assert.equal(valueState([1]),'invalid');
});
test('column diagnostics count all occurrences while bounding examples and preserving full source',async()=>{
 const t=await table('energy_kwh,note\n'+Array.from({length:24},(_,i)=>`${i%2?'NaN':''},text`).join('\n'));
 const q=analyzeTable(t,{file:'data.csv'});assert.equal(q.columns[0].missing,12);assert.equal(q.columns[0].invalid,12);assert.equal(q.diagnostics.find(d=>d.code==='invalid-number').count,12);assert.equal(q.diagnostics.find(d=>d.code==='invalid-number').examples.length,5);assert.equal(t.rows.length,24);
});
test('unknown text columns and additional numeric channels are supported, not rejected',async()=>{
 const t=await table('timestamp,custom_energy_kwh,note\n2023-01-01,2,hello\n2023-01-02,3,world\n');const q=analyzeTable(t,{file:'data.csv',timeKey:'timestamp'});assert.equal(q.columns.length,1);assert.equal(q.diagnostics.length,0);
});
test('a corrupt Parquet file reports its filename and impact without erasing valid files',async()=>{
 const s=await parse([asset('2023-01-01T00:00Z,1,1\n'),file('exported_data_bad_ep0.parquet','broken')]);assert(s.series.some(s=>s.rows.length===1));const d=s.quality.diagnostics.find(d=>d.code==='unreadable-file');assert.equal(d.file,'exported_data_bad_ep0.parquet');assert.equal(d.severity,'error');
});
test('partition source records identify each physical part separately',async()=>{
 const t=await readPartitions([entry(file('exported_data_A_ep0_part00000.csv','timestamp,energy_kwh\n2023-01-01,1\n')),entry(file('exported_data_A_ep0_part00001.csv','timestamp,energy_kwh\n2023-01-02,2,extra\n'))]);
 assert.equal(t.rows[1][SOURCE].file,'exported_data_A_ep0_part00001.csv');assert.equal(t.rows[1][SOURCE].record,1);assert(t.diagnostics.some(d=>d.code==='field-count'&&d.record===1));
});
test('all-failed imports retain a diagnostics-only result instead of fabricated data',async()=>{
 const s=await parse([file('exported_data_bad_ep0.parquet','broken')]);assert.equal(s.series.length,0);assert.equal(s.kpis,null);assert(s.quality.diagnostics.length);
});
test('one rejected folder does not discard other folders in the same batch',async()=>{
 const groups=[{name:'A'},{name:'B'},{name:'C'}];const r=await parseResultGroups(groups,async g=>{if(g.name==='B')throw new Error('cannot read');return {name:g.name};});assert.deepEqual(r.simulations.map(s=>s.name),['A','C']);assert.equal(r.rejected[0].folder,'B');assert.equal(r.rejected[0].message,'cannot read');
});
test('unique wide KPIs survive duplicate identities, with all duplicates excluded',async()=>{
 const s=await parse([kpi('KPI,District\ncost_total_control_eur,80\nx,1\nx,2\ny,3\n')]);assert.deepEqual(s.kpis.rows.map(r=>r.KPI),['cost_total_control_eur','y']);assert(s.tables.some(t=>t.rows.length===4));assert.equal(s.quality.diagnostics.filter(d=>d.code==='kpi-identity').length,2);assert(s.dataIssues.length);
});
test('unique long KPI identities survive another ambiguous entity/metric pair',async()=>{
 const s=await parse([file('kpis.csv','level,name,cost_function,value\ndistrict,District,cost_total_control_eur,80\nbuilding,A,cost,1\nbuilding,A,cost,2\nbuilding,B,cost,3\n')]);assert(s.kpis);assert.equal(s.kpis.rows.find(r=>r.KPI==='cost').B,'3');assert(!s.kpis.columns.includes('A'));assert(s.tables.some(t=>t.rows.length===4));
});
test('conflicting long levels are not guessed or merged',async()=>{
 const s=await parse([file('kpis.csv','level,name,cost_function,value\ndistrict,District,cost,80\nbuilding,A,x,1\ndistrict,A,y,2\n')]);assert.deepEqual(s.kpis.columns,['KPI','District']);assert(s.dataIssues.length);
});
test('invalid numeric KPI values stay inspectable and cannot establish a clean pairing',async()=>{
 const s=await parse([kpi('KPI,District\ncost_total_control_eur,NaN\nother,2\n')]);assert.equal(s.kpis.rows[0].District,'NaN');assert(s.dataIssues.some(d=>d.includes('invalid numeric')));assert(s.quality.diagnostics.some(d=>d.code==='invalid-number'&&d.examples[0].record===1));
});
test('optional metadata failure is local and reported even with valid data',async()=>{
 const s=await parse([asset('2023-01-01T00:00Z,1,1\n'),file('manifest.json','{oops')]);assert(s.series.length);assert(s.quality.diagnostics.some(d=>d.code==='invalid-metadata'));
});
test('a bad clock record is isolated while valid calendar measurements keep their true timestamps',async()=>{
 const s=await parse([asset('2023-01-01T00:00Z,1,1\nbad,100,100\n2023-01-01T00:30Z,3,3\n')]);const a=s.series[0],t=prepareTimeline(a);assert.equal(t.mode,'utc');assert.equal(t.rows.length,2);assert.equal(a.rows.length,3);assert.equal(a.quality.clockRejectedCount,1);assert(s.quality.diagnostics.some(d=>d.code==='invalid-clock'&&d.record===2));
});
test('fully unresolved clocks remain explorable as source rows',async()=>{
 const s=await parse([asset('bad,1,1\nalso bad,2,2\n')]);const t=prepareTimeline(s.series[0]);assert.equal(t.mode,'row');assert.equal(t.rows.length,2);assert(s.series[0].quality.clockUncertain);
});
test('duplicate clock evidence is reported without silently deleting source rows',async()=>{
 const s=await parse([asset('2023-01-01T00:00Z,1,1\n2023-01-01T00:00Z,2,2\n')]);assert.equal(s.series[0].rows.length,2);assert(s.quality.diagnostics.some(d=>d.code==='duplicate-clock'));assert(s.series[0].quality.clockUncertain);
});
test('aggregate sum, partial subtotal and unknown are three distinct states',()=>{
 const c=[{field:'energy_kwh',strategy:'sum'}];
 const a=aggregateChartGroup(0,[{energy_kwh:1},{energy_kwh:2}],c),b=aggregateChartGroup(0,[{energy_kwh:1},{energy_kwh:null}],c),d=aggregateChartGroup(0,[{energy_kwh:null},{energy_kwh:'NaN'}],c);
 assert.equal(a.energy_kwh,3);assert.equal(a[SIGNAL_COVERAGE].status,'complete');assert.equal(b.energy_kwh,1);assert.equal(b[SIGNAL_COVERAGE].status,'partial');assert.equal(d.energy_kwh,null);assert.equal(d[SIGNAL_COVERAGE].status,'unknown');
});
test('missing time positions make interval coverage partial without inserting zero rows',()=>{
 const rows=[{timestamp:0,kwh:1},{timestamp:1800000,kwh:3}];const q=chartCoverage(rows,[{field:'kwh'}],{intervalMs:900000,range:[0,1800000]});assert.equal(q.expected,3);assert.equal(q.unique,2);assert.equal(q.status,'partial');assert.equal(rows.length,2);
});
test('without a population contract, coverage of supplied values is distinct from unknown interval coverage',()=>{
 const q=chartCoverage([{timestamp:0,kwh:1}],[{field:'kwh'}]);assert.equal(q.status,'complete');assert.equal(q.expected,null);
});
test('unknown charger energy is not a fictitious zero; one available input is a partial subtotal',()=>{
 const s={columns:['Charger Consumption-kWh','Charger Production-kWh'],numericColumns:[]};const config=getEquipmentChartConfig({type:'charger',series:s}).series.filter(c=>c.field==='__charger_net');
 const a=aggregateChartGroup(0,[{'Charger Consumption-kWh':null,'Charger Production-kWh':null}],config);assert.equal(a.__charger_net,null);assert.equal(a[SIGNAL_COVERAGE].status,'unknown');
 const b=aggregateChartGroup(0,[{'Charger Consumption-kWh':2,'Charger Production-kWh':null}],config);assert.equal(b.__charger_net,2);assert.equal(b[SIGNAL_COVERAGE].status,'partial');
 const c=aggregateChartGroup(0,[{'Charger Consumption-kWh':-1,'Charger Production-kWh':-1}],config);assert.equal(c.__charger_net,0);assert.equal(c[SIGNAL_COVERAGE].status,'complete');
});
test('signed battery branches retain numeric conventions while validating the underlying measurement',()=>{
 const s={columns:['Battery (Dis)Charge-kWh','Battery Soc-%'],numericColumns:[]};const c=getEquipmentChartConfig({type:'battery',series:s}).series.filter(c=>c.key==='battery-charge');
 const a=aggregateChartGroup(0,[{'Battery (Dis)Charge-kWh':-2},{'Battery (Dis)Charge-kWh':2}],c);assert.equal(a.__battery_charge,2);assert.equal(a[SIGNAL_COVERAGE].status,'complete');
 const b=aggregateChartGroup(0,[{'Battery (Dis)Charge-kWh':null},{'Battery (Dis)Charge-kWh':2}],c);assert.equal(b.__battery_charge,2);assert.equal(b[SIGNAL_COVERAGE].status,'partial');
});

test('equal basenames in different selected subdirectories retain distinct source paths',async()=>{
 const a=entry(file('data.csv','energy_kwh\n1\n','run/A')),b=entry(file('data.csv','energy_kwh\nNaN\n','run/B'));
 const left=await readTable(a),right=await readTable(b);assert.notEqual(left.rows[0][SOURCE].path,right.rows[0][SOURCE].path);
 const q=analyzeTable(right,{file:'data.csv'});assert.equal(q.diagnostics.find(d=>d.code==='invalid-number').examples[0].path,'run/B/data.csv');
});
test('grid gaps are explicit uncertainty, not zeros or definite member absence',async()=>{
 const s=await parse([asset('2023-01-01T00:00Z,1,1\n2023-01-01T00:30Z,3,3\n'),file('manifest.json',JSON.stringify({seconds_per_time_step:900}))]);
 assert(s.quality.diagnostics.some(d=>d.code==='clock-gap'&&d.count===1));assert.equal(s.series[0].rows.length,2);
});

test('numeric-looking and textual long entity IDs remain identities, not invalid measurements',async()=>{
 const s=await parse([file('kpis.csv','level,name,cost_function,value\ndistrict,District,cost,80\nbuilding,001,cost,1\nbuilding,__proto__,cost,2\n')]);
 assert(s.kpis.columns.includes('001'));assert(s.kpis.columns.includes('__proto__'));assert(!s.quality.diagnostics.some(d=>d.code==='invalid-number'));assert.equal(s.dataIssues.length,0);
});
test('a long KPI column containing only NaN is still diagnosed as a numeric value column',async()=>{
 const s=await parse([file('kpis.csv','level,name,cost_function,value\ndistrict,District,cost,NaN\n')]);
 assert(s.quality.diagnostics.some(d=>d.code==='invalid-number'&&d.column==='value'));assert(s.dataIssues.some(d=>d.includes('invalid numeric')));
});
test('alternative and additional KPI tables have structured diagnostics and remain inspectable',async()=>{
 const s=await parse([kpi('KPI,District\ncost,1\n'),file('other_kpis.csv','KPI,District\ncost,2\n')]);
 assert(s.quality.diagnostics.some(d=>d.code==='additional-kpi'));assert(s.series.some(s=>s.tableOnly));
});

test('an excluded trailing record cannot make a reconstructed community appear complete',async()=>{
 const s=await parse([asset('2023-01-01T00:00Z,1,1\n2023-01-01T00:15Z,100,100,extra\n'),file('manifest.json',JSON.stringify({seconds_per_time_step:900,effective_schema:{buildings:{A:{include:true}}}}))]);
 const result=reconstructCommunity(buildEquipmentTree(s,'ep0').buildings,s,'ep0').series;assert.equal(result.rows.length,1);assert(result.aggregationEvidence.sourceIncomplete);assert(result.aggregationEvidence.warnings.some(w=>w.includes('known subtotals')));
});

test('source-row exploration does not treat row coordinates as physical milliseconds for coverage',()=>{
 assert.equal(declaredIntervalMs({mode:'row',secondsPerStep:900}),null);assert.equal(declaredIntervalMs({mode:'index',secondsPerStep:null}),null);
 assert.equal(declaredIntervalMs({mode:'utc',secondsPerStep:900}),900000);assert.equal(declaredIntervalMs({mode:'elapsed',secondsPerStep:900}),900000);
});

test('coverage counts actual grid positions when a date filter is off the source phase',()=>{
 const rows=[{timestamp:900000,kwh:1},{timestamp:4500000,kwh:2}];
 const q=chartCoverage(rows,[{field:'kwh'}],{intervalMs:3600000,range:[0,7200000]});assert.equal(q.expected,2);assert.equal(q.status,'complete');
});
test('incompatible positions on one declared grid remain unverified rather than complete',()=>{
 const q=chartCoverage([{timestamp:0,kwh:1},{timestamp:300000,kwh:2}],[{field:'kwh'}],{intervalMs:900000,range:[0,300000]});
 assert.equal(q.offGrid,true);assert.equal(q.expected,null);assert.equal(q.status,'partial');
});
