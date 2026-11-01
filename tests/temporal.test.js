import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {prepareTimeline,parseCalendarTime,temporalContext,formatTimelineValue,inferIntervalMinutes,timeBounds,formatInterval,GLOBAL_STEP,COVERAGE} from '../src/results/temporal.js';
import {reconstructCommunity} from '../src/results/community.js';
import {aggregateRowsForChart} from '../src/results/aggregation.js';
import {parseResultFolder,groupResultFiles} from '../src/results/import.js';
import {buildEquipmentTree} from '../src/results/equipment.js';

const NET='Net Electricity Consumption-kWh',LOAD='Non-shiftable Load-kWh';
const series=(times,extra={})=>({id:'test',timeKey:'timestamp',columns:['timestamp',NET,LOAD],rows:times.map((timestamp,i)=>({timestamp,[NET]:i+1,[LOAD]:i+1})),...extra});
const numeric=(steps,context={})=>series(steps,{timeKey:'time_step',columns:['time_step',NET],rows:steps.map((time_step,i)=>({time_step,[NET]:i+1})),temporal:context});
const building=(id,s)=>({entityId:id,label:id,items:[{type:'consumption',series:s}]});
const rebuild=(members,manifest={})=>reconstructCommunity(Object.entries(members).map(([id,s])=>building(id,s)),{id:'run',metadata:{manifest}},'ep0');
const sum=rows=>rows.reduce((n,r)=>n+(r[NET]??0),0);
const contract=(seconds=900,start=4176)=>({secondsPerStep:seconds,startDate:'2023-01-01',timezone:'Europe/Lisbon',episodeStart:start});
const schema=()=>({seconds_per_time_step:3600,start_date:'2023-01-01',timezone:'UTC',topology_mode:'dynamic',buildings:{A:{include:true},B:{include:false}},topology_events:[{time_step:1,operation:'add_member',target_member_id:'B'},{time_step:2,operation:'remove_member',target_member_id:'A'}]});

for(const seconds of [60,300,900,3600])test(`${seconds}s indices use exported origin, resolution and nonzero episode offset`,()=>{
 const t=prepareTimeline(numeric([0,1,2],contract(seconds,4132)));
 assert.equal(t.mode,'utc');assert.equal(t.rows[0].timestamp,Date.UTC(2023,0,1)+4132*seconds*1000);assert.equal(t.rows[1].timestamp-t.rows[0].timestamp,seconds*1000);
 assert.equal(t.rows[0][GLOBAL_STEP],4132);assert.equal(t.baseIntervalMinutes,seconds/60);assert.equal(sum(t.rows),6);
});
test('global_step does not receive an episode offset twice',()=>{
 const s=numeric([4180,4181],contract());s.timeKey='global_step';s.rows=s.rows.map(r=>({...r,global_step:r.time_step}));s.columns[0]='global_step';
 assert.equal(prepareTimeline(s).rows[0].timestamp,Date.UTC(2023,0,1)+4180*900000);
});
test('an explicit numeric index-origin contract is supported',()=>{
 assert.equal(prepareTimeline(numeric([4180],{...contract(),indexOrigin:'global'})).rows[0][GLOBAL_STEP],4180);
});
test('native metadata is optional and an episode-specific manifest is not imposed on other episodes',()=>{
 const metadata={manifest:{seconds_per_time_step:900,episode_start_time_step:10,effective_schema:{start_date:'2023-01-01',timezone:'UTC'},temporal_reproducibility:{episode_index:2}}};
 assert.equal(temporalContext(metadata,'ep2').secondsPerStep,900);assert.deepEqual(temporalContext(metadata,'ep1'),{});assert.equal(temporalContext().secondsPerStep,null);
});
test('legacy timestamps keep wall time without inheriting the browser timezone',()=>{
 const t=prepareTimeline(series(['2024-08-01T00:00:00','2024-08-01T01:00:00']));assert.equal(t.mode,'local');assert.equal(t.rows[0].timestamp,Date.UTC(2024,7,1));assert(t.basis.includes('timezone not exported'));
 const code=`import {parseCalendarTime} from ${JSON.stringify(new URL('../src/results/temporal.js',import.meta.url).href)};console.log(parseCalendarTime('2024-08-01T00:00:00').timestamp)`;
 for(const TZ of ['Europe/Lisbon','America/New_York','Asia/Tokyo'])assert.equal(Number(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ}})),Date.UTC(2024,7,1));
});
test('explicit offsets at fall DST represent distinct ordered instants',()=>{
 const t=prepareTimeline(series(['2023-10-29T01:30:00+00:00','2023-10-29T01:30:00+01:00']));
 assert.equal(t.mode,'utc');assert.equal(t.rows[1].timestamp-t.rows[0].timestamp,3600000);assert.notEqual(formatTimelineValue(t,t.rows[0].timestamp,true),formatTimelineValue(t,t.rows[1].timestamp,true));assert(formatTimelineValue(t,t.rows[0].timestamp,true).endsWith('UTC'));
});
test('spring DST does not create an extra physical hour',()=>{
 const t=prepareTimeline(series(['2023-03-26T00:30:00+00:00','2023-03-26T02:30:00+01:00']));assert.equal(t.rows[1].timestamp-t.rows[0].timestamp,3600000);
});
test('a declared timezone resolves unique local instants including summer offset',()=>{
 assert.equal(parseCalendarTime('2023-07-01T12:00:00','Europe/Lisbon').timestamp,Date.UTC(2023,6,1,11));
 assert.equal(parseCalendarTime('2023-01-01T12:00:00','Europe/Lisbon').timestamp,Date.UTC(2023,0,1,12));
});
test('ambiguous, nonexistent and malformed dates do not get a fabricated offset or calendar',()=>{
 for(const stamp of ['2023-10-29T01:30:00','2023-03-26T01:30:00','2023-02-30T12:00:00','not a date']){
  const t=prepareTimeline(series([stamp],{temporal:{timezone:'Europe/Lisbon'}}));assert.equal(t.mode,'row');assert.equal(t.rows.length,1);assert(t.warnings.length);
 }
});
test('invalid timezone and mixed floating/absolute clocks retain rows on an explicit relative axis',()=>{
 assert.equal(prepareTimeline(series(['2023-01-01T00:00:00'],{temporal:{timezone:'bad zone'}})).mode,'row');
 const t=prepareTimeline(series(['2023-01-01T00:00:00','2023-01-01T01:00:00Z']));assert.equal(t.mode,'row');assert.equal(sum(t.rows),3);
});
test('missing timestamps are preserved in source order instead of dropped or assigned January 2026',()=>{
 const t=prepareTimeline(series(['2023-01-01T00:00:00Z',null,'bad']));assert.equal(t.mode,'row');assert.equal(t.rows.length,3);assert.equal(sum(t.rows),6);assert.equal(formatTimelineValue(t,t.rows[1].timestamp),'Row 1');
});
test('indices with resolution but no calendar have physical display windows and index labels',()=>{
 const t=prepareTimeline(numeric([4176,4177],{secondsPerStep:900}));assert.equal(t.mode,'elapsed');assert.equal(t.rows[1].timestamp-t.rows[0].timestamp,900000);assert.equal(formatTimelineValue(t,t.rows[0].timestamp),'Step 4176');assert(!formatTimelineValue(t,t.rows[0].timestamp).includes('1970'));
});
test('indices without resolution remain indices and retain non-contiguous steps',()=>{
 const t=prepareTimeline(numeric([7,10]));assert.equal(t.mode,'index');assert.equal(formatTimelineValue(t,t.rows[1].timestamp),'Step 10');assert.equal(formatInterval(10,t),'10 steps');assert(!t.basis.includes('hour'));
});
test('row positions without a clock cannot infer member start dates from a shared dataset origin',()=>{
 const s=series([null,null],{timeKey:null,columns:[NET],rows:[{[NET]:2},{[NET]:3}],temporal:contract()});assert.equal(prepareTimeline(s).mode,'row');
});
test('hour/month observations are not treated as elapsed hour clocks',()=>{
 const s=series([],{timeKey:null,columns:['month','hour',NET],rows:[{month:1,hour:4,[NET]:1},{month:1,hour:5,[NET]:2}]});assert.equal(prepareTimeline(s).mode,'row');
});
test('sub-minute and sparse timestamps are not rounded/clamped to an invented interval',()=>{
 assert.equal(inferIntervalMinutes([{timestamp:0},{timestamp:1000},{timestamp:10000}]),1/60);assert.equal(formatInterval(1/60),'1s');assert.equal(formatInterval(90),'90m');assert.equal(inferIntervalMinutes([{timestamp:0}]),null);
});
test('fixed display buckets remain anchored across gaps and selection boundaries',()=>{
 const rows=[0,45,75,100].map((m,i)=>({timestamp:m*60000,[NET]:i+1}));const a=aggregateRowsForChart(rows,60,[{field:NET,strategy:'sum'}]);assert.deepEqual(a.map(r=>r.timestamp),[0,3600000]);assert.deepEqual(a.map(r=>r[NET]),[3,7]);assert.equal(sum(a),10);
 const b=aggregateRowsForChart(rows.slice(2),60,[{field:NET,strategy:'sum'}],{origin:0});assert.equal(b[0].timestamp,3600000);
});
test('seconds, rates and signed interval energies keep their values under aggregation',()=>{
 const s=numeric([0,1,2,3],contract(1,0));s.rows=s.rows.map((r,i)=>({...r,[NET]:i%2?-(i+1):i+1,power_kw:i+1}));const t=prepareTimeline(s);
 for(const minutes of [1/60,2/60,1,60]){const a=aggregateRowsForChart(t.rows,minutes,[{field:NET,strategy:'sum'},{field:'power_kw',strategy:'avg'}]);assert.equal(sum(a),-2);}
});
test('incompatible multi-chart clocks cannot share a guessed date/range',()=>{
 const a=series(['2023-01-01T00:00:00Z']),b=numeric([0,1]);assert.equal(timeBounds([{series:a},{series:b}]).compatible,false);
 assert.equal(timeBounds([{series:numeric([0,1],{secondsPerStep:60})},{series:numeric([0,1],{secondsPerStep:900})}]).compatible,false);
});

test('community joins timestamps, not row indices: A00=1/A01=2 and B01=10',()=>{
 const A=series(['2023-01-01T00:00:00Z','2023-01-01T01:00:00Z']),B=series(['2023-01-01T01:00:00Z']);B.rows[0][NET]=10;
 const r=rebuild({A,B}).series;assert.deepEqual(r.rows.map(r=>r[NET]),[1,12]);assert.equal(sum(r.rows),13);assert(r.aggregationEvidence.warnings[0].includes('unknown'));
});
test('declared admission/departure distinguishes an absent member from missing active measurements',()=>{
 const c={secondsPerStep:3600,startDate:'2023-01-01',timezone:'UTC',episodeStart:0};
 const A=numeric([0,1],c),B=numeric([1,2],c);B.rows=B.rows.map(r=>({...r,[NET]:10}));
 const r=rebuild({A,B},{effective_schema:schema()}).series;assert.deepEqual(r.rows.map(r=>r[NET]),[1,12,10]);assert.deepEqual(r.rows.map(r=>r[COVERAGE].expected),[1,2,1]);assert.deepEqual(r.rows.map(r=>r[COVERAGE].absent),[1,0,1]);assert.equal(r.aggregationEvidence.partialIntervals,0);
});
test('ISO timestamps can place native global-step topology events with exported origin/resolution',()=>{
 const c={secondsPerStep:3600,startDate:'2023-01-01',timezone:'UTC',episodeStart:0};
 const A=series(['2023-01-01T00:00:00Z','2023-01-01T01:00:00Z'],{temporal:c}),B=series(['2023-01-01T01:00:00Z'],{temporal:c});
 const r=rebuild({A,B},{effective_schema:schema()}).series;assert.equal(r.rows[0][COVERAGE].absent,1);assert.equal(r.rows[0][COVERAGE].missing,0);
});
test('missing measurements in active members remain partial, without shifting later energy',()=>{
 const A=numeric([0,1,2],{secondsPerStep:900}),B=numeric([0,2],{secondsPerStep:900});B.rows[1][NET]=10;
 const r=rebuild({A,B},{effective_schema:{buildings:{A:{include:true},B:{include:true}}}}).series;
 assert.deepEqual(r.rows.map(r=>r[NET]),[2,2,13]);assert.equal(r.rows[1][COVERAGE].missing,1);assert.equal(r.rows[2][COVERAGE].missing,0);assert.equal(sum(r.rows),17);
});
test('an active declared member with no imported series is not silently zero',()=>{
 const r=rebuild({A:numeric([0,1])},{effective_schema:{buildings:{A:{include:true},B:{include:true}}}}).series;assert.equal(r.rows[0][COVERAGE].expected,2);assert.equal(r.rows[0][COVERAGE].missing,1);assert.equal(r.rows[0][NET],1);
});
test('missing channel values are unknown while genuine zero and negative energy remain valid',()=>{
 const A=numeric([0,1,2]);A.rows=A.rows.map((r,i)=>({...r,[NET]:[null,0,-3][i]}));
 const r=rebuild({A},{effective_schema:{buildings:{A:{include:true}}}}).series;assert.deepEqual(r.rows.map(r=>r[NET]),[null,0,-3]);assert.equal(r.rows[0][COVERAGE].partial,true);assert.equal(r.rows[1][COVERAGE].partial,false);
});
test('optional absent equipment channels are not invented as zero-valued community fields',()=>{
 const r=rebuild({A:numeric([0])}).series;assert(!r.columns.includes('Energy Production From EV-kWh'));assert(!r.columns.includes('Energy Production from PV-kWh'));
});
test('duplicate member instants are ambiguous contributions, never doubled silently',()=>{
 const A=series(['2023-01-01T00:00:00Z','2023-01-01T00:00:00Z']);const B=series(['2023-01-01T00:00:00Z']);B.rows[0][NET]=10;
 const r=rebuild({A,B}).series;assert.equal(r.rows[0][NET],10);assert.equal(r.rows[0][COVERAGE].ambiguous,1);assert.equal(sum(prepareTimeline(A).rows),3);assert(r.aggregationEvidence.warnings.some(w=>w.includes('Repeated')));
});
test('different calendar kinds, row-only clocks and declared sample durations do not create a guessed community',()=>{
 assert.equal(rebuild({A:numeric([0]),B:series(['2023-01-01T00:00Z'])}).series,null);
 assert.equal(rebuild({A:series(['bad'])}).series,null);
 assert.equal(rebuild({A:numeric([0],{secondsPerStep:60}),B:numeric([0],{secondsPerStep:900})}).series,null);
});
test('explicit inactive observations are distinguished from absent or unknown membership',()=>{
 const A=numeric([0]);A.columns.push('active');A.rows[0].active=0;
 const r=rebuild({A}).series;assert.equal(r.rows[0][COVERAGE].absent,1);assert.equal(r.rows[0][COVERAGE].conflicts,1);assert.equal(r.rows[0][NET],1);
});
test('membership events with explicit offsets work without a dataset-origin date',()=>{
 const A=series(['2023-01-01T00:00Z','2023-01-01T01:00Z']),B=series(['2023-01-01T01:00Z']);
 const s=schema();s.topology_events=s.topology_events.slice(0,1).map(e=>({...e,timestamp_local:'2023-01-01T01:00Z'}));
 const r=rebuild({A,B},{effective_schema:s}).series;assert.equal(r.rows[0][COVERAGE].absent,1);assert.equal(r.rows[1][COVERAGE].expected,2);
});
test('partial coverage propagates through larger display buckets',()=>{
 const r=rebuild({A:numeric([0,1]),B:numeric([1])}).series;
 const grouped=aggregateRowsForChart(prepareTimeline(r).rows,10,[{field:NET,strategy:'sum'}]);assert.equal(grouped[0][COVERAGE].partial,true);assert.equal(grouped[0][COVERAGE].intervals,2);assert.equal(sum(grouped),4);
});
test('imported optional metadata reaches the temporal resolver without changing raw values',async()=>{
 const f=(name,text)=>({name,webkitRelativePath:'run/'+name,size:text.length,lastModified:0,text:async()=>text});
 const group=groupResultFiles([f('exported_data_A_ep0.csv','time_step,Net Electricity Consumption-kWh,Non-shiftable Load-kWh\n0,1,1\n1,2,2\n'),f('manifest.json',JSON.stringify({seconds_per_time_step:300,episode_start_time_step:10,effective_schema:{start_date:'2023-01-01',timezone:'UTC'}}))])[0];
 const imported=await parseResultFolder(group);assert.equal(imported.series[0].rows[0].time_step,'0');const tree=buildEquipmentTree(imported,'ep0');assert.equal(tree.buildings.length,1);assert.equal(prepareTimeline(imported.series[0]).rows[0].timestamp,Date.UTC(2023,0,1)+3000000);
});

test('membership established before a nonzero episode is applied at its first interval',()=>{
 const c={secondsPerStep:3600,startDate:'2023-01-01',timezone:'UTC',episodeStart:3};
 const r=rebuild({B:numeric([0,1],c)},{effective_schema:schema()}).series;
 assert.equal(r.rows[0][COVERAGE].absent,1);assert.equal(r.rows[0][COVERAGE].expected,1);assert.equal(r.rows[0][COVERAGE].missing,0);
});
test('render-origin overrides are not reconstructed from a potentially unrelated numeric calendar',()=>{
 const t=prepareTimeline(numeric([0,1],{...contract(),renderOriginOverride:true}));assert.equal(t.mode,'elapsed');assert.equal(t.rows.length,2);
});
test('actual timestamps take precedence over a conflicting optional origin date',()=>{
 const t=prepareTimeline(series(['2024-08-01T00:00:00Z'],{temporal:contract(900,10)}));assert.equal(t.rows[0].timestamp,Date.UTC(2024,7,1));
});

test('different declared sample durations do not share controls even with UTC timestamps',()=>{
 const a=series(['2023-01-01T00:00Z'],{temporal:{secondsPerStep:60}}),b=series(['2023-01-01T00:00Z'],{temporal:{secondsPerStep:900}});
 assert.equal(timeBounds([{series:a},{series:b}]).compatible,false);
});
test('a supplied global step accompanying ISO time is retained as membership evidence',()=>{
 const s=series(['2023-01-01T00:00Z']);s.columns.push('global_step');s.rows[0].global_step=100;assert.equal(prepareTimeline(s).rows[0][GLOBAL_STEP],100);
});

test('reconstructed rows expose absence, missing data and channel coverage separately',()=>{
 const r=rebuild({A:numeric([0]),B:numeric([1])},{effective_schema:{buildings:{A:{include:true},B:{include:true},C:{include:false}}}}).series;
 assert.equal(r.rows[0]['Declared absent members'],1);assert.equal(r.rows[0]['Missing/unknown member rows'],1);
 assert.equal(r.rows[0]['Observed member rows'],1);assert.equal(r.rows[0]['Channel coverage'][NET].observed,1);
 assert(r.columns.includes('Missing/unknown member rows'));
});
test('declared UTC preserves fractional instants before 1970',()=>{
 assert.equal(parseCalendarTime('1969-12-31T23:59:59.500','UTC').timestamp,-500);
});

test('a calendar declared inconsistent cannot establish an absolute numeric clock',()=>{
 const metadata={manifest:{seconds_per_time_step:900,effective_schema:{start_date:'2023-01-01',timezone:'UTC'},temporal_reproducibility:{clock_consistent:false}}};
 const t=prepareTimeline(numeric([0,1],temporalContext(metadata)));assert.equal(t.mode,'elapsed');assert(t.warnings.some(w=>w.includes('inconsistent')));
});
test('a canonical dataset clock is distinct from a different declared control duration',()=>{
 const metadata={manifest:{seconds_per_time_step:300,effective_schema:{start_date:'2023-01-01',timezone:'UTC'},temporal_reproducibility:{clock_source:'canonical_calendar',dataset_seconds_per_time_step:900}}};
 const t=prepareTimeline(numeric([0,1],temporalContext(metadata)));assert.equal(t.rows[1].timestamp-t.rows[0].timestamp,900000);assert.equal(t.baseIntervalMinutes,15);assert(t.warnings.some(w=>w.includes('control duration is 300 s')));assert.equal(sum(t.rows),3);
});

test('internal temporal evidence does not overwrite similarly named imported measurements',()=>{
 const s=numeric([0,1]);s.rows=s.rows.map(r=>({...r,__globalStep:1234,__coverage:7}));s.columns.push('__globalStep','__coverage');
 const t=prepareTimeline(s);assert.equal(t.rows[0].__globalStep,1234);assert.equal(t.rows[0].__coverage,7);assert.equal(t.rows[0][GLOBAL_STEP],0);
 assert.equal(aggregateRowsForChart(t.rows,10,[{field:'__coverage',strategy:'sum'}])[0].__coverage,14);
});
