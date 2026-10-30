'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compare}=require('../compare.cjs');
const empty=()=>({errors:[],blocks:{},biomes:{},entities:[],blockEntities:[],items:[],data:{}});
test('missing registries, storage counts, owner UUID and restart loss fail closed',()=>{
  const a=empty();a.blocks['iceandfire:silver_ore']=9;
  a.items=[{file:'playerdata/owner.dat',path:'/Inventory/0',id:'minecraft:diamond',count:64,nbt:{}}];
  a.entities=[{id:'iceandfire:fire_dragon',uuid:'[1,2,3,4]',nbt:{Owner:[5,6,7,8],Variant:2,AgeTicks:200,Gender:true}}];
  a.data['data/dank.dat']={owner:[5,6,7,8],count:90};
  assert.equal(compare(a,structuredClone(a)).verdict,'PASS');
  const b=structuredClone(a);b.items[0].count=1;b.entities[0].nbt.Owner=[0,0,0,0];delete b.data['data/dank.dat'];
  const r=compare(a,b,{registries:{blocks:[],items:['minecraft:diamond'],entities:['iceandfire:fire_dragon'],biomes:[]}});
  for(const kind of ['inventory','dragon','saved data','missing registry'])assert.ok(r.differences.some(d=>d.kind===kind),kind);
  assert.equal(r.verdict,'LOSS');
  b.entities=[];assert.equal(compare(a,b).verdict,'LOSS');
});
test('Dank ExtendedCount, not wrapped signed byte Count, defines quantities',()=>{
  const a=empty();a.items=[{file:'data/dankstorage/0.dat',path:'/data/contents/Items/0',id:'minecraft:stone',count:-64,nbt:{ExtendedCount:960}}];
  const b=structuredClone(a);b.items[0].count=0;
  assert.equal(compare(a,b).verdict,'PASS');b.items[0].nbt.ExtendedCount=704;
  assert.equal(compare(a,b).verdict,'LOSS');
});
test('mod-owned camouflage and cell payload fields cannot silently disappear',()=>{
  const a=empty();a.blockEntities=[{id:'roundwood:round_door',dimension:'minecraft:overworld',position:[1,2,3],nbt:{Camouflage:{Name:'minecraft:oak_planks'}}}];
  const b=structuredClone(a);delete b.blockEntities[0].nbt.Camouflage;
  assert.equal(compare(a,b).verdict,'LOSS');
});
