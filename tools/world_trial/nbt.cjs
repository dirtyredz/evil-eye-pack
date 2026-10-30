'use strict';
// Adapted from the read-only 2026-10-30 I&F scan; preserve numeric longs as BigInt.
const fs=require('node:fs'), path=require('node:path'), zlib=require('node:zlib');
class NbtReader {
  constructor(buffer) { this.b = buffer; this.o = 0; }
  need(n) { if (!Number.isSafeInteger(n) || n < 0 || this.o + n > this.b.length) throw new Error(`NBT truncated at ${this.o}, need ${n}, length ${this.b.length}`); }
  u8() { this.need(1); return this.b.readUInt8(this.o++); }
  i8() { this.need(1); return this.b.readInt8(this.o++); }
  i16() { this.need(2); const v = this.b.readInt16BE(this.o); this.o += 2; return v; }
  u16() { this.need(2); const v = this.b.readUInt16BE(this.o); this.o += 2; return v; }
  i32() { this.need(4); const v = this.b.readInt32BE(this.o); this.o += 4; return v; }
  i64() { this.need(8); const v = this.b.readBigInt64BE(this.o); this.o += 8; return v; }
  f32() { this.need(4); const v = this.b.readFloatBE(this.o); this.o += 4; return v; }
  f64() { this.need(8); const v = this.b.readDoubleBE(this.o); this.o += 8; return v; }
  bytes(n) { this.need(n); const v = this.b.subarray(this.o, this.o + n); this.o += n; return v; }
  str() { return this.bytes(this.u16()).toString('utf8'); }
  payload(type) {
    switch (type) {
      case 1: return this.i8();
      case 2: return this.i16();
      case 3: return this.i32();
      case 4: return this.i64();
      case 5: return this.f32();
      case 6: return this.f64();
      case 7: { const n = this.i32(); if (n < 0) throw new Error(`negative byte array ${n}`); return this.bytes(n); }
      case 8: return this.str();
      case 9: { const t = this.u8(), n = this.i32(); this.need(n); if(n && !t)throw new Error('Nonempty END list'); return Array.from({length:n}, () => this.payload(t)); }
      case 10: { const out = {}; while (true) { const t = this.u8(); if (!t) return out; const key=this.str(); if(Object.hasOwn(out,key))throw new Error('Duplicate NBT key: '+key); Object.defineProperty(out,key,{value:this.payload(t),enumerable:true,writable:true,configurable:true}); } }
      case 11: { const n = this.i32(); this.need(n*4); return Array.from({length:n}, () => this.i32()); }
      case 12: { const n = this.i32(); this.need(n*8); return Array.from({length:n}, () => this.i64()); }
      default: throw new Error(`unsupported NBT tag ${type} at ${this.o - 1}`);
    }
  }
  root() { const type = this.u8(); if (!type) return null; const name = this.str(); const value = this.payload(type); return {name, value}; }
}

function parseNbt(buffer) { const r = new NbtReader(buffer); const root = r.root(); if (!root) throw new Error('empty NBT root'); if(r.o!==buffer.length)throw new Error('Trailing NBT bytes'); return root.value; }
function gunzipMaybe(buffer) { return buffer[0] === 0x1f && buffer[1] === 0x8b ? zlib.gunzipSync(buffer) : buffer; }
function decompressChunk(payload, externalFile) {
  const type = payload[0] & 0x7f, external = !!(payload[0] & 0x80);
  const bytes = external ? fs.readFileSync(externalFile) : payload.subarray(1);
  if (type === 1) return zlib.gunzipSync(bytes);
  if (type === 2) return zlib.inflateSync(bytes);
  if (type === 3) return bytes;
  throw new Error(`unsupported region compression ${type}${external ? ' (external)' : ''}`);
}
function dimensionFor(relative) {
  const p = relative.split(path.sep);
  if (p[0] === 'DIM-1') return 'minecraft:the_nether';
  if (p[0] === 'DIM1') return 'minecraft:the_end';
  if (p[0] === 'dimensions' && p.length >= 4) return `${p[1]}:${p.slice(2, -2).join('/')}`;
  return 'minecraft:overworld';
}
const packedCounts = new Map();
function paletteCounts(section) {
  const states = section.block_states ?? (section.BlockStates && {palette:section.Palette,data:section.BlockStates});
  const palette = states?.palette;
  if (!Array.isArray(palette) || !palette.length) return [];
  if (palette.length === 1) return [{index:0,count:4096,locals:null}];
  const data = states.data;
  if (!Array.isArray(data) || !data.length) throw new Error(`palette ${palette.length} has no block-state data`);
  const bits=Math.max(4,Math.ceil(Math.log2(palette.length))), perLong=Math.floor(64/bits), mask=(1n<<BigInt(bits))-1n, byIndex=new Map();
  if(data.length<Math.ceil(4096/perLong))throw new Error('Truncated block-state array');
  for (let i=0;i<Math.ceil(4096/perLong);i++) {
    const word=BigInt.asUintN(64,data[i]), n=Math.min(perLong,4096-i*perLong), key=bits+':'+n+':'+word;
    let counts=packedCounts.get(key);
    if(!counts) {
      counts=new Map();let w=word;
      for(let j=0;j<n;j++){const idx=Number(w&mask);counts.set(idx,(counts.get(idx)||0)+1);w>>=BigInt(bits);}
      if(packedCounts.size>100000)packedCounts.clear();packedCounts.set(key,counts);
    }
    for(const [idx,count]of counts){
      if(idx>=palette.length)throw new Error('Invalid palette index');
      let row=byIndex.get(idx);if(!row)byIndex.set(idx,row={index:idx,count:0});row.count+=count;
    }
  }
  return [...byIndex.values()];
}

module.exports={parseNbt,gunzipMaybe,decompressChunk,dimensionFor,paletteCounts};
