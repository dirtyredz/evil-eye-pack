'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../probe/capture.js'),'utf8');
function harness(ready) {
  let loaded,tick;const writes={},forced=[];
  const reg={keySet:()=>({toArray:()=>[]})};
  const level={dimension:()=>({location:()=>'minecraft:overworld'}),setChunkForced:(x,z,on)=>forced.push([x,z,on]),getChunk:()=>{},isPositionEntityTicking:()=>ready};
  const server={getAllLevels:()=>{let done=false;return {iterator:()=>({hasNext:()=>!done,next:()=>{done=true;return level;}})};},registryAccess:()=>({registryOrThrow:()=>reg}),runCommandSilent:()=>{}};
  vm.runInNewContext(code,{ServerEvents:{loaded:f=>{loaded=f;},tick:f=>{tick=f;}},JsonIO:{read:()=>({token:'token',targets:[{dimension:'minecraft:overworld',x:3,z:-4}]}),write:(f,v)=>{writes[f]=v;}},Java:{loadClass:n=>n.endsWith('BuiltInRegistries')?{ITEM:reg,BLOCK:reg,ENTITY_TYPE:reg,BLOCK_ENTITY_TYPE:reg}:n.endsWith('BlockPos')?function(){}:{BIOME:'biome'}}});
  loaded({server});return {writes,forced,tick:()=>tick({server})};
}
test('probe waits for entity readiness, releases its ticket and writes token completion',()=>{
  const h=harness(true);h.tick();assert.equal(h.writes['world-trial-complete.json'],undefined);h.tick();
  const r=h.writes['world-trial-complete.json'];assert.equal(r.token,'token');assert.equal(r.visited.length,1);assert.equal(r.errors.length,0);assert.deepEqual(h.forced,[[3,-4,true],[3,-4,false]]);
});
test('probe readiness timeout is incomplete evidence, never success',()=>{
  const h=harness(false);for(let i=0;i<201;i++)h.tick();const r=h.writes['world-trial-complete.json'];assert.equal(r.errors.length,1);assert.equal(r.visited[0].entityTicking,false);assert.equal(h.forced.at(-1)[2],false);
});
