'use strict';
// Visit every stored stack, named/owned entity, dragon and colony. Other entities/block entities
// are sampled per type/dimension, port terrain per region. All saved bytes are inventoried offline.
function plan(inventory) {
  const regions=new Set(),selected=new Map(),kinds=new Set();
  const add=(dimension,x,z,reason)=>{
    const key=dimension+':'+x+':'+z;
    if(!selected.has(key))selected.set(key,{dimension,x,z,reasons:[]});
    const reasons=selected.get(key).reasons;if(!reasons.includes(reason))reasons.push(reason);
  };
  for(const e of [...(inventory.entities||[]),...(inventory.blockEntities||[])]) {
    const kind=e.dimension+'|'+e.id;
    if(!kinds.has(kind)){add(e.dimension,...e.chunk,'type sample '+e.id);kinds.add(kind);}
    if(e.nbt.CustomName||e.nbt.Owner||e.nbt.OwnerUUID||/_dragon$/.test(e.id)||e.id.startsWith('minecolonies:'))add(e.dimension,...e.chunk,'named/owned/dragon/colony');
  }
  for(const e of inventory.items||[])if(e.chunk)add(e.dimension,...e.chunk,'stored inventory');
  for(const t of inventory.targets) {
    const important=t.reasons.some(r=>r==='player'||r==='spawn');
    const key=t.dimension+':'+Math.floor(t.x/32)+':'+Math.floor(t.z/32);
    if(important||!regions.has(key)){add(t.dimension,t.x,t.z,important?'player/spawn':'region terrain sample');regions.add(key);}
  }
  const targets=[...selected.values()].sort((a,b)=>a.dimension.localeCompare(b.dimension)||a.x-b.x||a.z-b.z);
  const citizens=(inventory.entities||[]).filter(e=>e.id==='minecolonies:citizen');
  const colonyChunks=[...new Map(citizens.map(e=>[e.chunk.join(','),{x:e.chunk[0],z:e.chunk[1]}])).values()];
  const colonies=[...new Set(citizens.map(e=>e.nbt.colony))].filter(Number.isInteger);
  return {targets,colonyProbe:{chunks:colonyChunks,colonies,ticks:400},totalCandidateChunks:inventory.targets.length,terrainSampling:'all stored stacks, named/owned entities, dragons, colony and player/spawn chunks; one sample per entity/block-entity type and dimension; one terrain sample per region'};
}
module.exports={plan};
