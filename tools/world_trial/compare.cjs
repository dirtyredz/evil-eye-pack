'use strict';
// Conservative differences remain LOSS until reviewed with explicit evidence, never inferred expected.
const { json }=require('./inventory.cjs');
function compare(before,after,{registries,expected={}}={}) {
  const differences=[];
  function diff(kind,key,a,b) {
    if(json(a)===json(b))return;
    const rule=expected[kind+'|'+key];
    differences.push({kind,key,before:a??null,after:b??null,classification:rule?'expected':'LOSS',reason:rule||'unexplained semantic difference'});
  }
  for(const [side,inv]of [['before',before],['after',after]])if(inv.errors.length)diff('incomplete',side,[],inv.errors);
  for(const kind of ['blocks','biomes'])for(const key of Object.keys(before[kind])) {
    // Palette membership is a reference count, not a biome volume count.
    if(kind==='biomes') {if(!after[kind][key])diff(kind,key,true,false);}
    else if((after[kind][key]||0)<before[kind][key])diff(kind,key,before[kind][key],after[kind][key]||0);
  }
  for(const kind of ['entities','blockEntities']) {
    const key=e=>kind==='entities'?e.id+'|'+e.uuid:e.dimension+'|'+e.position.join(',');
    const map=new Map(after[kind].map(e=>[key(e),e]));
    for(const e of before[kind]) {
      const next=map.get(key(e));if(!next){diff(kind,key(e),e,null);continue;}
      if(/_dragon$/.test(e.id))for(const field of ['Variant','AgeTicks','Gender','Owner','UUID','CustomName','Items'])diff('dragon',key(e)+'|'+field,e.nbt[field],next.nbt[field]);
      for(const field of ['Owner','OwnerUUID','UUID','CustomName','Items','Inventory','ForgeCaps','neoforge:attachments'])diff(kind,key(e)+'|'+field,e.nbt[field],next.nbt[field]);
    }
  }
  // Per-location stack totals expose discarded inventories; retain payloads for component review.
  function stacks(inv){const m={};for(const e of inv.items){const key=e.file+'|'+(e.chunk||[]).join(',')+'|'+e.path+'|'+e.id;m[key]={count:Number(e.nbt.ExtendedCount??e.count),tag:e.nbt.tag??e.nbt.components??null};}return m;}
  const a=stacks(before),b=stacks(after);for(const key of Object.keys(a))diff('inventory',key,a[key],b[key]);
  for(const [file,v]of Object.entries(before.data)) {
    if(/playerdata\/|minecolonies|dank|ae2/i.test(file))diff('saved data',file,v,after.data[file]);
  }
  if(registries)for(const [kind,ids]of Object.entries({blocks:Object.keys(before.blocks),entities:before.entities.map(e=>e.id),items:before.items.map(e=>e.id),biomes:Object.keys(before.biomes)})) {
    if(!Array.isArray(registries[kind])){diff('registry evidence',kind,true,false);continue;}
    const live=new Set(registries[kind]);for(const id of new Set(ids))if(!live.has(id))diff('missing registry',kind+'|'+id,true,false);
  }
  return {schema:1,verdict:differences.some(d=>d.classification==='LOSS')?'LOSS':'PASS',differences};
}
module.exports={compare};
