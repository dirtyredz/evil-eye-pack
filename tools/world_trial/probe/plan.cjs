'use strict';
// Visit every entity/container/player chunk. Terrain-only port chunks are sampled per region;
// all their persisted blocks still participate in the offline inventory/registry comparison.
function plan(inventory) {
  const regions=new Set(),targets=[];
  for(const t of inventory.targets) {
    const important=t.reasons.some(r=>r!=='port blocks');
    const key=t.dimension+':'+Math.floor(t.x/32)+':'+Math.floor(t.z/32);
    if(important||!regions.has(key)){targets.push(t);regions.add(key);}
  }
  return {targets,totalCandidateChunks:inventory.targets.length,terrainSampling:'one port-only chunk per region plus every entity/block-entity/player/spawn chunk'};
}
module.exports={plan};
