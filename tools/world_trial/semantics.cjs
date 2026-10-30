'use strict';
// Domain views retain payloads where a mod-specific codec has no proven cross-version mapping.
// Never equate an unchanged opaque file with a successful live storage-access check.
function semantics(inv) {
  const data=inv.data;
  const playerRecords=Object.entries(data).filter(([f])=>f.startsWith('playerdata/'));
  if(data['level.dat']?.Data?.Player)playerRecords.push(['level.dat#Data.Player',data['level.dat'].Data.Player]);
  const players=Object.fromEntries(playerRecords.map(([f,p])=>[f,{uuid:p.UUID,inventory:p.Inventory,enderChest:p.EnderItems,curios:p.ForgeCaps?.['curios:inventory']??p['neoforge:attachments']?.['curios:inventory'],attachments:p.ForgeCaps??p['neoforge:attachments'],position:p.Pos,dimension:p.Dimension}]));
  const colonies=Object.fromEntries(Object.entries(data).filter(([f])=>/minecolonies\/.*colony\d+\.dat$/.test(f)).map(([f,c])=>[f,{id:c.id,owner:c.owner,ownerid:c.ownerid,owners:c.owners,center:c.center,buildings:c.buildingManager?.buildings,citizens:c.citizenManager?.citizens,requests:c.requestManager,work:c.work}]));
  const dank=Object.fromEntries(Object.entries(data).filter(([f])=>/data\/dankstorage\//.test(f)).map(([f,d])=>{
    const c=d.data?.contents??d.contents??d;
    return [f,{locked:c.locked,tier:c.DankStats,items:(c.Items||[]).map(i=>({slot:i.Slot,id:i.id,count:Number(i.ExtendedCount??i.count??i.Count),tag:i.tag??i.components})),ghostItems:c.GhostItems,raw:c}];
  }));
  const dragons=inv.entities.filter(e=>/^iceandfire:.*_dragon$/.test(e.id)).map(e=>({id:e.id,uuid:e.uuid,source:e.file.includes('entities/')?'entity region':'pending terrain entity',dimension:e.dimension,chunk:e.chunk,position:e.nbt.Pos,variant:e.nbt.Variant,ageTicks:e.nbt.AgeTicks,gender:e.nbt.Gender,owner:e.nbt.Owner??e.nbt.OwnerUUID??null,inventory:e.nbt.Items}));
  const storage=inv.items.filter(e=>/^(ae2|ae2things|megacells|arseng):.*(cell|pattern)/.test(e.id));
  return {players,colonies,dank,dragons,ae2CellsAndPatterns:storage,dankLinks:inv.items.filter(e=>e.id.startsWith('dankstorage:')),dankDocks:inv.blockEntities.filter(e=>e.id?.startsWith('dankstorage:')),roundwood:inv.blockEntities.filter(e=>e.id?.startsWith('roundwood:')),arsInstrumentum:inv.items.filter(e=>/^ars_instrumentum:/.test(e.id)),namedOrOwned:inv.entities.filter(e=>e.nbt.CustomName||e.nbt.Owner||e.nbt.OwnerUUID),silver:Object.fromEntries(Object.entries(inv.blocks).filter(([id])=>/^iceandfire:.*silver_ore$/.test(id))),biomes:Object.keys(inv.biomes),terrainChunks:Object.keys(inv.terrain).length,errors:inv.errors};
}
module.exports={semantics};
