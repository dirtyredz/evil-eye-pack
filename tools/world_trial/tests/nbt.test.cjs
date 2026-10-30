'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseNbt,paletteCounts,dimensionFor}=require('../nbt.cjs');
const path=require('node:path');
test('NBT preserves signed 64-bit values and rejects truncation and invalid palettes',()=>{
  const raw=Buffer.from('0a000004000178ffffffffffffffff00','hex');
  assert.equal(parseNbt(raw).x,-1n);
  assert.throws(()=>parseNbt(raw.subarray(0,-1)),/truncated/);
  assert.throws(()=>parseNbt(Buffer.concat([raw,Buffer.from([0])])),/Trailing/);
  const section={block_states:{palette:[{Name:'minecraft:air'},{Name:'iceandfire:silver_ore'}],data:Array(256).fill(0n)}};
  section.block_states.data[0]=0x1111111111111111n;
  assert.equal(paletteCounts(section).find(x=>x.index===1).count,16);
  section.block_states.data=[];assert.throws(()=>paletteCounts(section),/no block-state data/);
  assert.equal(dimensionFor(['dimensions','mod','nested','moon','region','r.0.0.mca'].join(path.sep)),'mod:nested/moon');
});
