'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../probe/capture.js'),'utf8');
function harness(ready, colonyProbe, colonyApi) {
  let loaded,tick;const writes={},forced=[];
  const reg={keySet:()=>({toArray:()=>[]})};
  const level={dimension:'minecraft:overworld',setChunkForced:(x,z,on)=>forced.push([x,z,on]),getChunk:()=>{},isPositionEntityTicking:()=>ready};
  const server={overworld:()=>level,getAllLevels:()=>{let done=false;return {iterator:()=>({hasNext:()=>!done,next:()=>{done=true;return level;}})};},registryAccess:()=>({registryOrThrow:()=>reg}),runCommandSilent:()=>{}};
  vm.runInNewContext(code,{ServerEvents:{loaded:f=>{loaded=f;},tick:f=>{tick=f;}},JsonIO:{read:()=>({token:'token',targets:[{dimension:'minecraft:overworld',x:3,z:-4}],coverage:{colonyProbe}}),write:(f,v)=>{writes[f]=v;}},Java:{loadClass:n=>n.endsWith('IColonyManager')&&colonyApi?colonyApi:n.endsWith('BuiltInRegistries')?{ITEM:reg,BLOCK:reg,ENTITY_TYPE:reg,BLOCK_ENTITY_TYPE:reg}:n.endsWith('BlockPos')?function(){}:{BIOME:'biome'}}});
  loaded({server});return {writes,forced,tick:()=>tick({server})};
}
test('probe waits for entity readiness, releases its ticket and writes token completion',()=>{
  const h=harness(true);h.tick();assert.equal(h.writes['world-trial-complete.json'],undefined);h.tick();
  const r=h.writes['world-trial-complete.json'];assert.equal(r.token,'token');assert.equal(r.visited.length,1);assert.equal(r.errors.length,0);assert.deepEqual(h.forced,[[3,-4,true],[3,-4,false]]);
});
test('probe readiness timeout is incomplete evidence, never success',()=>{
  const h=harness(false);for(let i=0;i<201;i++)h.tick();const r=h.writes['world-trial-complete.json'];assert.equal(r.errors.length,1);assert.equal(r.visited[0].entityTicking,false);assert.equal(h.forced.at(-1)[2],false);
});

test('colony probe holds forced chunks for bounded ticks and records unsupported binding access honestly',()=>{
  const h=harness(true,{chunks:[{x:60,z:-34}],colonies:[1],ticks:400});
  for(let i=0;i<399;i++)h.tick();
  assert.equal(h.writes['world-trial-colony.json'],undefined);
  assert.deepEqual(h.forced,[[60,-34,true]]);
  h.tick();const r=h.writes['world-trial-colony.json'];
  assert.equal(r.ticks,400);assert.equal(r.token,'token');
  assert.equal(r.chunks[0].ticking,true);assert.equal(r.errors.length,1);
  assert.deepEqual(h.forced,[[60,-34,true],[60,-34,false]]);
  h.tick();h.tick();assert.equal(h.writes['world-trial-complete.json'].visited.length,1);
});

test('colony observer reports bidirectional native bindings after the bounded tick period',()=>{
  const entity={uuid:'citizen-native',isRemoved:()=>false,getCitizenData:()=>({getId:()=>4})};
  const citizen={getId:()=>4,getEntity:()=>({isPresent:()=>true,get:()=>entity})};
  const api={getInstance:()=>({getColonyByWorld:(id)=>{assert.equal(id,1);return {getCitizenManager:()=>({getCitizens:()=>({iterator:()=>{let read=false;return {hasNext:()=>!read,next:()=>{read=true;return citizen;}};}})})};}})};
  const h=harness(true,{chunks:[{x:60,z:-34}],colonies:[1],ticks:400},api);
  for(let i=0;i<400;i++)h.tick();const r=h.writes['world-trial-colony.json'];
  assert.equal(r.errors.length,0);assert.equal(r.observed[0].bound,true);assert.equal(r.observed[0].colony,1);assert.equal(r.observed[0].removed,false);
});
