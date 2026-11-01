import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readTable,readPartitions,adaptKpis,tableIdentity} from '../src/results/tabular.js';
import {groupResultFiles,parseResultFolder} from '../src/results/import.js';
import {compareSimulationContext,assessComparison,metadataSummary} from '../src/results/context.js';
import {buildEquipmentTree} from '../src/results/equipment.js';
import {toNumber} from '../src/results/values.js';

const ROOT=new URL('./fixtures/formats/',import.meta.url);
const file=(name,body,folder='run')=>({name,webkitRelativePath:folder+'/'+name,size:typeof body==='string'?Buffer.byteLength(body):body.length,lastModified:0,
 text:async()=>typeof body==='string'?body:body.toString('utf8'),arrayBuffer:async()=>{const b=Buffer.from(body);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}});
const fromFixture=(relative,name=relative.split('/').pop(),folder='run')=>file(name,fs.readFileSync(new URL(relative,ROOT)),folder);
const folderFiles=(format,folder='run')=>fs.readdirSync(new URL(format+'/',ROOT)).map(n=>fromFixture(format+'/'+n,n,folder));
const entry=f=>({file:f,fileName:f.name,relativePath:f.webkitRelativePath});
const parse=files=>parseResultFolder(groupResultFiles(files)[0]);
const csv=(name,text)=>file(name,text);
const wide=()=>csv('exported_kpis.csv','KPI,District,Member_001\ndistrict_cost_total_control_eur,80,\nbuilding_cost_total_control_eur,,10\n');
function values(kpis){return Object.fromEntries(kpis.rows.flatMap(r=>kpis.columns.filter(c=>c!==kpis.labelKey).map(c=>[JSON.stringify([r[kpis.labelKey],c]),toNumber(r[c])])));}
function meta(){return JSON.parse(fs.readFileSync(new URL('native.manifest.json',ROOT),'utf8'));}
const sim=(name,manifest,extra={})=>({name,metadata:{manifest},...extra});

test('genuine wide CSV and Parquet import the same numeric KPI identities, zeroes and unknowns',async()=>{
 const a=await parse(folderFiles('csv')),b=await parse(folderFiles('parquet'));
 assert.deepEqual(values(a.kpis),values(b.kpis));assert.equal(b.series.length,a.series.length);
 assert.equal(b.series.find(s=>s.resultKey==='member_001_ep0').rows.length,192);
 const t=buildEquipmentTree(b,'ep0');assert.equal(t.buildings.length,1);assert.equal(t.buildings[0].chargers.length,1);assert.equal(t.buildings[0].batteries.length,1);assert.equal(t.vehicles.length,1);
});
test('native long KPI shape preserves indicators, member IDs, levels and all numeric values',async()=>{
 const a=await parse(folderFiles('csv')),b=await parse([fromFixture('long.csv','kpis.csv')]);
 assert.deepEqual(values(a.kpis),values(b.kpis));assert.equal(b.kpis.levels.District,'district');assert.equal(b.kpis.levels.Member_001,'building');
 assert(b.tables.some(t=>t.label==='Original long KPI rows'));
});
test('unknown filenames with a declared KPI schema are recognised by content',async()=>{
 const a=await parse([fromFixture('long.csv','metrics.csv')]);assert.equal(a.kpis.inputShape,'long');
});
for(const codec of ['gzip','zstd','brotli','plain'])test(`local Parquet ${codec} decodes timestamps, nulls and exact integer IDs`,async()=>{
 const t=await readTable(entry(fromFixture(`codec-${codec}.parquet`)));assert.equal(t.rows.length,2);
 assert.equal(t.rows[0].timestamp,'2023-01-01T00:00:00.000Z');assert.equal(t.rows[1].energy_kwh,null);assert.equal(t.rows[0].large_id,'9007199254740993');
});
test('parts are joined numerically even if file selection order is reversed',async()=>{
 const f=folderFiles('parquet').filter(f=>f.name.startsWith('exported_data_member_001_ep0_')).reverse();
 const t=await readPartitions(f.map(entry));assert.equal(t.rows.length,192);assert.equal(t.rows[0].timestamp,'2023-01-01T00:00:00+00:00');assert.equal(t.warnings.length,0);
});
test('partition gaps, corrupt parts and schema differences remain explicit and do not erase valid data',async()=>{
 const f=fromFixture('parquet/exported_data_member_001_ep0_part00000.parquet');
 const gap=file(f.name.replace('00000','00002'),Buffer.from(await f.arrayBuffer()));
 const t=await readPartitions([entry(gap),entry(f),entry(file('exported_data_member_001_ep0_part00001.parquet','bad parquet'))]);
 assert(t.rows.length>0);assert(t.warnings.some(w=>w.includes('part00001')));
 const missing=await readPartitions([entry(gap),entry(f)]);assert(missing.warnings.some(w=>w.includes('numbering')));
 const mixed=await readPartitions([entry(csv('exported_data_home_ep0_part00000.csv','timestamp,a\n2023-01-01,1\n')),entry(csv('exported_data_home_ep0_part00001.csv','timestamp,b\n2023-01-02,2\n'))]);
 assert.equal(mixed.rows.length,1);assert(mixed.sources.some(s=>s.incompatible));
});
test('asset IDs containing part-like text are not silently merged without a native episode suffix',()=>{
 assert.equal(tableIdentity(entry(file('exported_data_factory_part00001.parquet',''))).part,null);
});
test('a malformed optional sidecar does not prevent valid legacy data from opening',async()=>{
 const s=await parse([wide(),csv('exported_kpis.manifest.json','{broken')]);assert(s.kpis);assert.equal(s.metadata.manifest,null);assert(s.warnings.some(w=>w.includes('manifest')));
});
test('unrelated JSON/files and nested parent directories do not become extra simulations',()=>{
 const f=[file('exported_kpis.csv','KPI,District\ncost,1\n','root/A'),file('exported_kpis.csv','KPI,District\ncost,2\n','root/B'),file('manifest.json','{}','root/notes'),file('README.txt','irrelevant','root')];
 const groups=groupResultFiles(f);assert.equal(groups.length,2);assert.deepEqual(groups.map(g=>g.name),['A','B']);
});
test('same folder names under different parents remain distinct',()=>{
 const g=groupResultFiles([file('kpis.csv','KPI,District\ncost,1\n','root/A/run'),file('kpis.csv','KPI,District\ncost,2\n','root/B/run')]);
 assert.deepEqual(g.map(g=>g.name),['run','run 2']);
});
test('metadata binds to the KPI sibling stem, and outcome coverage is available without replacing KPI values',async()=>{
 const s=await parse([wide(),fromFixture('native.manifest.json','exported_kpis.manifest.json'),fromFixture('exported_kpis.deferrable_service.json'),fromFixture('exported_kpis.robustness.json')]);
 assert.equal(s.kpis.rows[0].District,'80');assert.equal(s.metadata.manifest.simulator_version,'1.9.11');
 const m=metadataSummary(s.metadata);assert.equal(m.secondsPerStep,900);assert.equal(m.completedIntervals,192);assert.equal(m.serviceDefinition,'deferrable-service-audit-v1');assert.equal(m.robustnessDefinition,'robustness-audit-v1');assert(m.finalInventory.length);
});
test('standalone manifest/service files from the long auditor are also recognised',async()=>{
 const s=await parse([fromFixture('long.csv','kpis.csv'),fromFixture('native.manifest.json','manifest.json'),fromFixture('exported_kpis.deferrable_service.json','service.json')]);
 assert(s.metadata.manifest);assert(s.metadata.service);
});
test('absence of sidecars is supported and is not invented as a matching context',async()=>{
 const a=await parse([wide()]);assert(a.kpis);assert.equal(a.metadata.manifest,null);
 assert.equal(compareSimulationContext(a,{...a,name:'B'}).status,'unknown');
});
test('an auxiliary table with an unknown KPI layout remains readable, alongside valid results',async()=>{
 const s=await parse([wide(),csv('other_kpis.csv','name,value\nhello,3\n'),csv('events.csv','event,description\nnotice,raw text\n')]);
 assert(s.kpis);assert(s.series.some(s=>s.tableOnly&&s.rows[0].description==='raw text'));
 assert(s.series.some(s=>s.tableOnly&&s.rows[0].name==='hello'));
});
test('a broken data file does not erase other imported series or KPIs',async()=>{
 const s=await parse([wide(),file('exported_data_broken_ep0.parquet','not parquet'),csv('exported_data_sensor_ep0.csv','timestamp,energy_kwh\n2023-01-01,2\n')]);
 assert(s.kpis);assert(s.series.some(s=>s.rows[0]?.energy_kwh==='2'));assert(s.dataIssues.length);
});
test('CSV/Parquet variants are not double-counted and the alternative remains inspectable',async()=>{
 const s=await parse([...folderFiles('csv'),...folderFiles('parquet')]);
 const t=buildEquipmentTree(s,'ep0');assert.equal(t.buildings.length,1);assert.equal(t.buildings[0].chargers.length,1);
 assert(s.series.some(s=>s.tableOnly&&s.label.startsWith('Alternative')));assert(s.warnings.some(w=>w.includes('Multiple representations')));
});
test('duplicate long KPI identities are not averaged or silently overwritten',async()=>{
 const s=await parse([csv('kpis.csv','level,name,cost_function,value\ndistrict,District,cost,1\ndistrict,District,cost,2\n')]);
 assert.equal(s.kpis,null);assert(s.series[0].tableOnly);assert.equal(s.series[0].rows.length,2);assert(s.warnings.some(w=>w.includes('Duplicate')));
});
test('long KPIs preserve unusual entity IDs and reserve only an internal indicator column',()=>{
 const rows=['KPI','__proto__','constructor','001'].map((name,i)=>({name,cost_function:'cost',value:i,level:'building',unit:'EUR'}));
 const k=adaptKpis({rows,columns:['name','cost_function','value','level','unit']},'kpis.csv');
 assert.notEqual(k.labelKey,'KPI');assert.equal(k.rows[0].KPI,0);assert.equal(k.rows[0].__proto__,1);assert.equal(k.rows[0].constructor,2);assert.equal(k.rows[0]['001'],3);
});
test('empty Parquet/schema cases are represented without synthetic zero rows',async()=>{
 const t=adaptKpis({rows:[],columns:['KPI','District']},'exported_kpis.parquet');assert.equal(t.rows.length,0);
});
test('metadata summary preserves zeroes, false booleans and missing values distinctly',()=>{
 const m=metadataSummary({manifest:{completed_intervals:0,random_seed:0,business_as_usual_reference:{evaluated:false}}});
 assert.equal(m.completedIntervals,0);assert.equal(m.seed,0);assert.equal(m.referenceEvaluated,false);assert.equal(m.secondsPerStep,null);
});
test('complete declared contexts can match while final inventories and service outcomes differ',()=>{
 const a=meta(),b=structuredClone(a);b.final_inventory=[];b.deferrable_service_audit={...b.deferrable_service_audit,district:{offered_count:999}};
 assert.equal(compareSimulationContext(sim('A',a),sim('B',b)).status,'matched');
});
for(const [field,change]of [
 ['completed_intervals',v=>v+1],['seconds_per_time_step',()=>3600],['random_seed',v=>v+1],
 ['physical_configuration_sha256',()=> 'a'.repeat(64)],['data_files_sha256',()=>({other:'b'.repeat(64)})],
 ['initial_inventory',()=>[]],['observation',()=>({interface:'flat',agent_contract:{mode:'hidden'}})],
 ['market',v=>({...v,local_price_ratio_to_grid_import:.9})],['engine',v=>({...v,version:'older'})]
])test(`known context differences prevent paired judgements: ${field}`,()=>{
 const a=meta(),b=structuredClone(a);b.comparison_context[field]=change(b.comparison_context[field]);
 const r=compareSimulationContext(sim('A',a),sim('B',b));assert.equal(r.status,'different');assert(r.differences.length);
});
test('minimum manifests still expose definite differences without pretending to be a complete contract',()=>{
 const r=compareSimulationContext(sim('A',{simulator_version:'1',seconds_per_time_step:900}),sim('B',{simulator_version:'2',seconds_per_time_step:3600}));
 assert.equal(r.status,'different');assert(r.differences.includes('Simulator version'));
});
test('matching sparse/invalid metadata does not establish a paired experiment',()=>{
 for(const m of [{},{comparison_context:{}},{comparison_context:{definition_version:'paired-experiment-v1',engine:{}}}])assert.equal(compareSimulationContext(sim('A',m),sim('B',m)).status,'unknown');
});
test('different controller implementations/parameters are allowed when observation access matches',()=>{
 const a=meta(),b=structuredClone(a);b.controller_identity.implementation='other';b.controller_identity.version='2';b.controller_identity.parameters={different:true};
 assert.equal(compareSimulationContext(sim('A',a),sim('B',b)).status,'matched');
 b.controller_identity.observation_access='agent_payload';assert.equal(compareSimulationContext(sim('A',a),sim('B',b)).status,'different');
});
test('different reference definitions or input mutation remain visible and prevent a paired conclusion',()=>{
 const a=meta(),b=structuredClone(a);b.business_as_usual_reference.definition_version='other';b.input_file_changes={changed:true};
 const r=compareSimulationContext(sim('A',a),sim('B',b));assert.equal(r.status,'different');
});
test('incomplete imports cannot establish a paired comparison even with identical manifests',()=>{
 const a=meta();assert.equal(compareSimulationContext(sim('A',a,{dataIssues:['missing part']}),sim('B',a)).status,'unknown');
});
test('comparison evaluation handles multiple simulations and no selected pair',()=>{
 const a=meta();assert.equal(assessComparison([sim('A',a)]).status,'unknown');assert.equal(assessComparison([sim('A',a),sim('B',a)]).status,'matched');
 const b=structuredClone(a);b.comparison_context.completed_intervals++;assert.equal(assessComparison([sim('A',a),sim('B',a),sim('C',b)]).status,'different');
});
test('format fixtures match their provenance hashes',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('provenance.json',ROOT)));
 for(const [name,hash]of Object.entries(p.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(name,ROOT))).digest('hex'),hash);
});

test('legacy wide KPI indicator headers remain accepted without requiring a literal KPI column',()=>{
 for(const label of ['Name','Cost metric','custom indicator']){
  const k=adaptKpis({columns:[label,'District'],rows:[{[label]:'cost',District:3}]},'exported_kpis.csv');
  assert.equal(k.labelKey,label);assert.equal(k.rows[0].District,3);
 }
});
test('unexpected optional inventory entries remain inspectable without crashing the context view',()=>{
 assert.deepEqual(metadataSummary({manifest:{final_inventory:[null,2,{id:'A'}]}}).finalInventory,[{value:null},{value:2},{id:'A'}]);
});

test('supplemental historical episode KPI files do not change the equipment episode selection',async()=>{
 const s=await parse([wide(),csv('exported_kpis_ep0.csv','KPI,District\ncost,1\n'),csv('exported_data_home_ep1.csv','timestamp,energy_kwh\n2023-01-01,2\n')]);
 assert.equal(s.series.find(s=>s.fileName==='exported_kpis_ep0.csv').episode,'');
 assert.equal(s.series.find(s=>s.fileName==='exported_data_home_ep1.csv').episode,'ep1');
});

test('duplicate partition numbers remain accessible without doubling energy',async()=>{
 const a=entry(csv('exported_data_home_ep0_part0.csv','timestamp,energy_kwh\n2023-01-01,1\n'));
 const b=entry(csv('exported_data_home_ep0_part00000.csv','timestamp,energy_kwh\n2023-01-01,100\n'));
 const t=await readPartitions([a,b]);assert.equal(t.rows.length,1);assert.equal(t.rows[0].energy_kwh,'1');
 assert(t.warnings.some(w=>w.includes('duplicate partition')));assert.equal(t.sources.find(s=>s.incompatible).table.rows[0].energy_kwh,'100');
});
