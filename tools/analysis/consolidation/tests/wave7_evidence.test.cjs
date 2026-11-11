'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const {collector,report,storageIds}=require('../wave7_evidence.cjs');

test('auxiliary files remain listed and external chunk uncertainty prevents completeness', t => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wave7-excluded-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'level.dat_old'),'historical');
 fs.writeFileSync(path.join(root,'session.lock'),'lock');
 const clean=report(root);assert.equal(clean.complete,true);assert.equal(clean.excludedFiles.length,2);
 fs.writeFileSync(path.join(root,'orphan.mcc'),'external');
 const uncertain=report(root);assert.equal(uncertain.complete,false);assert.equal(uncertain.excludedFiles.length,3);
 assert.deepEqual(uncertain.unsupportedFiles,[{file:'orphan.mcc',reason:'Cannot certify absence of orphan external chunks'}]);
 assert.deepEqual(uncertain.errors,[]);
});

test('all eleven mounted identities retain full documents, large counts and locations',()=>{
 const {result,visit}=collector();
 const payload={type:'createdrawerscompat:drawer',drawer_data:{
  state:{Name:'storagedrawers:compacting_drawers_3',Properties:{facing:'north'}},
  block_entity:{Count:9007199254740993n,Views:[{count:81},{count:9},{count:1}],
   components:{'minecraft:custom_name':'Saved'},Upgrades:[{id:'storagedrawers:void_upgrade'}],Locked:1}
 },unknown:{retain:'verbatim'}};
 visit({Trains:[{Contraption:{items:[{pos:42,storage:payload}]}}]}, {file:'data/create_tracks.dat'});
 visit({Data:{Player:{Inventory:[{tag:{contraption:{items:[{storage:payload}]}}}]}}}, {file:'level.dat'});
 assert.equal(result.mounted.length,1);assert.equal(result.mounted[0].occurrences.length,2);
 assert.deepEqual(result.mounted[0].payload,payload);
 assert.match(result.mounted[0].occurrences[0].path,/Trains\/0\/Contraption\/items\/0\/storage/);
 for(const id of storageIds) if(id!==payload.type)visit({storage:{type:id,private:{preserve:1}}},{file:'entities/r.0.0.mca'});
 assert.equal(result.mounted.length,11);assert.equal(result.errors.length,0);
 assert.equal(result.mounted[0].payload.drawer_data.block_entity.Count,9007199254740993n);
});
test('old capabilities, new attachments and embedded diagonal references are evidence, not totals',()=>{
 const {result,visit}=collector();
 visit({ForgeCaps:{'polymorph:player_recipe_data':{SelectedRecipe:'minecraft:old'}},
  'neoforge:attachments':{'polymorph:recipe_data':{SelectedRecipe:'minecraft:new'}},
  contraption:{state:{Name:'diagonalfences:minecraft/oak_fence'}},
  sections:[{block_states:{palette:[{Name:'minecraft:air'},{Name:'diagonalfences:minecraft/oak_fence'}]}}]}, {file:'x'});
 assert.equal(result.polymorph.length,4);assert.equal(result.diagonalReferences.length,2);
 assert.deepEqual(result.actualDiagonalBlocks,{});
});
test('malformed drawer documents are explicit failures',()=>{
 const {result,visit}=collector();visit({type:'createdrawerscompat:drawer',drawer_data:{}},{file:'bad.dat'});
 assert.equal(result.errors.length,1);assert.equal(result.mounted.length,1);
 visit({type:'createdrawerscompat:unknown',payload:{Count:42}},{file:'future.dat'});
 assert.equal(result.errors.length,2);assert.equal(result.errors[1].payload.payload.Count,42);
});
test('unsupported files and parse errors prevent complete evidence; structure NBT is visited',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wave7-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'unknown.bin'),Buffer.from('unknown'));
 fs.writeFileSync(path.join(root,'unknown.json'),'{"inventory":[]}');
 fs.writeFileSync(path.join(root,'broken.dat'),Buffer.from('bad'));
 const text=Buffer.from('diagonalfences:minecraft/oak_fence'),key=Buffer.from('Name');
 const str=b=>{const n=Buffer.alloc(2);n.writeUInt16BE(b.length);return Buffer.concat([n,b]);};
 fs.writeFileSync(path.join(root,'structure.nbt'),Buffer.concat([Buffer.from([10,0,0,8]),str(key),str(text),Buffer.from([0])]));
 const r=report(root);assert.equal(r.complete,false);assert.equal(r.unsupportedFiles.length,2);
 assert.equal(r.errors.length,1);assert.equal(r.diagonalReferences[0].file,'structure.nbt');
});

test('actual diagonal counts use packed palette indices, not unused palette entries',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wave7-palette-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'region'));
 const i32=n=>{const b=Buffer.alloc(4);b.writeInt32BE(n);return b;};
 const str=s=>{const b=Buffer.from(s),n=Buffer.alloc(2);n.writeUInt16BE(b.length);return Buffer.concat([n,b]);};
 const tag=(type,key,body)=>Buffer.concat([Buffer.from([type]),str(key),body]);
 const compound=tags=>Buffer.concat([...tags,Buffer.from([0])]);
 const palette=Buffer.concat([Buffer.from([10]),i32(2),compound([tag(8,'Name',str('minecraft:air'))]),
  compound([tag(8,'Name',str('diagonalfences:minecraft/oak_fence'))])]);
 for(const present of [false,true]) {
  const words=Buffer.alloc(256*8);if(present)words.writeBigInt64BE(1n);
  const states=compound([tag(9,'palette',palette),tag(12,'data',Buffer.concat([i32(256),words]))]);
  const section=compound([tag(1,'Y',Buffer.from([0])),tag(10,'block_states',states)]);
  const nbt=tag(10,'',compound([tag(9,'sections',Buffer.concat([Buffer.from([10]),i32(1),section]))]));
  const region=Buffer.alloc(12288);region.writeUInt32BE((2<<8)|1);region.writeUInt32BE(nbt.length+1,8192);
  region[8196]=3;nbt.copy(region,8197);fs.writeFileSync(path.join(root,'region/r.0.0.mca'),region);
  const r=report(root);assert.equal(r.complete,true);assert.equal(r.diagonalReferences.length,1);
  assert.equal(r.actualDiagonalBlocks['diagonalfences:minecraft/oak_fence']||0,present?1:0);
 }
});
