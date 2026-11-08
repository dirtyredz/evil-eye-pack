'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const { files }=require('./copy.cjs');
const { parseNbt,gunzipMaybe,decompressChunk,dimensionFor,paletteCounts }=require('../../data_io/nbt.cjs');
const json=v=>JSON.stringify(v,(_k,x)=>typeof x==='bigint'?x.toString():x);
const digest=v=>crypto.createHash('sha256').update(json(v)).digest('hex');
const add=(map,id,n=1)=>{map[id]=(map[id]||0)+n;};
function inventory(world, { visit = () => {} } = {}) {
  const out={schema:1,world,files:0,chunks:0,errors:[],blocks:{},biomes:{},entities:[],blockEntities:[],data:{},items:[],references:{},targets:[],terrain:{}};
  const targets=new Map();
  function target(dimension,x,z,reason) {
    const key=dimension+':'+x+':'+z;
    if(!targets.has(key))targets.set(key,{dimension,x,z,reasons:[]});
    const row=targets.get(key);if(!row.reasons.includes(reason))row.reasons.push(reason);
  }
  function inspect(v,context,trail='') {
    if(typeof v==='string') { if(/^[a-z][\w.-]*:[\w./-]+$/.test(v))add(out.references,v);return; }
    if(!v||typeof v!=='object'||Buffer.isBuffer(v))return;
    if(Array.isArray(v)&&v.length&&typeof v[0]!=='object'&&typeof v[0]!=='string')return;
    if(typeof v.id==='string'&&!Array.isArray(v.Pos)&&('Count'in v||'count'in v))out.items.push({...context,path:trail,id:v.id,count:Number(v.ExtendedCount??v.Count??v.count),nbt:v});
    for(const [k,x]of Object.entries(v)) { if(/^[a-z][\w.-]*:[\w./-]+$/.test(k))add(out.references,k);inspect(x,context,trail+'/'+k); }
  }
  for(const rel of files(world)) {
    const file=path.join(world,rel);out.files++;
    if((rel.endsWith('.dat')||rel.endsWith('.nbt'))&&!rel.includes('/backups/')) {
      try {
        const v=parseNbt(gunzipMaybe(fs.readFileSync(file)));out.data[rel]=v;inspect(v,{file:rel});visit(v,{file:rel});
        const p=v.Data?.Player||v;
        if(Array.isArray(p.Pos)&&typeof p.Dimension==='string')target(p.Dimension,Math.floor(p.Pos[0]/16),Math.floor(p.Pos[2]/16),'player');
        if(rel==='level.dat')target('minecraft:overworld',Math.floor(v.Data.SpawnX/16),Math.floor(v.Data.SpawnZ/16),'spawn');
      }catch(e){out.errors.push({file:rel,error:e.message});}
      continue;
    }
    if(!rel.endsWith('.mca')||!['region','entities'].includes(path.basename(path.dirname(file))))continue;
    const dim=dimensionFor(rel.split('/').join(path.sep)), m=/r\.(-?\d+)\.(-?\d+)\.mca$/.exec(rel),bytes=fs.readFileSync(file);
    if(!m){out.errors.push({file:rel,error:'invalid region filename'});continue;}
    if(!bytes.length)continue;
    if(bytes.length<8192){out.errors.push({file:rel,error:'short region'});continue;}
    for(let slot=0;slot<1024;slot++) {
      const loc=bytes.readUInt32BE(slot*4),sector=loc>>>8,sectors=loc&255;if(!sector&&!sectors)continue;
      const cx=Number(m[1])*32+(slot&31),cz=Number(m[2])*32+(slot>>5),context={file:rel,dimension:dim,chunk:[cx,cz]};
      try {
        const off=sector*4096;
        if(sector<2||!sectors||off+4>bytes.length)throw new Error('invalid region offset');
        const len=bytes.readUInt32BE(off);
        if(len<1||len>sectors*4096-4||off+4+len>bytes.length)throw new Error('invalid chunk length');
        const external=path.join(path.dirname(file),`c.${cx}.${cz}.mcc`);
        const nbt=parseNbt(decompressChunk(bytes.subarray(off+4,off+4+len),external));out.chunks++;
        inspect(nbt,context);visit(nbt,context);
        const n=nbt.Level||nbt;
        context.status=n.Status??null;
        const entities=n.Entities||n.entities||[];
        for(const e of entities){out.entities.push({...context,id:e.id,uuid:json(e.UUID??e.UUIDMost??null),nbt:e});target(dim,cx,cz,'entity');}
        const bes=n.block_entities||n.TileEntities||[];
        for(const e of bes){out.blockEntities.push({...context,id:e.id,position:[e.x,e.y,e.z],nbt:e});target(dim,cx,cz,'block entity');}
        const terrain=[];
        for(const s of n.sections||n.Sections||[]) {
          const palette=s.block_states?.palette||s.Palette;
          if(palette){for(const row of paletteCounts(s)){
            if(!palette[row.index])throw new Error('palette index out of range');
            const id=palette[row.index].Name;add(out.blocks,id,row.count);
            if(/^(iceandfire|roundwood|ars_instrumentum|alexsmobs|alexscaves):/.test(id))target(dim,cx,cz,'port blocks');
          }terrain.push({y:s.Y,states:s.block_states||{palette:s.Palette,data:s.BlockStates}});}
          for(const b of s.biomes?.palette||[])add(out.biomes,b);
        }
        if(terrain.length)out.terrain[dim+':'+cx+':'+cz]=digest(terrain);
      }catch(e){out.errors.push({...context,error:e.message});}
    }
  }
  out.targets=[...targets.values()].sort((a,b)=>a.dimension.localeCompare(b.dimension)||a.x-b.x||a.z-b.z);
  return out;
}
module.exports={inventory,json,digest};
