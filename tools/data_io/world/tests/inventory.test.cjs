'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {inventory}=require('../inventory.cjs');
const str=s=>{const b=Buffer.from(s),n=Buffer.alloc(2);n.writeUInt16BE(b.length);return Buffer.concat([n,b]);};
const int=n=>{const b=Buffer.alloc(4);b.writeInt32BE(n);return b;};
const tag=(type,name,bytes)=>Buffer.concat([Buffer.from([type]),str(name),bytes]);
test('inventory distinguishes entity Count from stacks and decodes Dank extended quantities',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'world-inventory-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const stack=Buffer.concat([tag(8,'id',str('minecraft:stone')),tag(1,'Count',Buffer.from([192])),tag(3,'ExtendedCount',int(960)),Buffer.from([0])]);
  const orb=Buffer.concat([tag(8,'id',str('minecraft:experience_orb')),tag(3,'Count',int(7)),tag(9,'Pos',Buffer.concat([Buffer.from([3]),int(3),int(1),int(2),int(3)])),Buffer.from([0])]);
  fs.writeFileSync(path.join(dir,'data.dat'),tag(10,'',Buffer.concat([tag(10,'stack',stack),tag(10,'orb',orb),Buffer.from([0])])));
  const result=inventory(dir);assert.deepEqual(result.errors,[]);assert.equal(result.items.length,1);assert.equal(result.items[0].count,960);assert.equal(result.items[0].id,'minecraft:stone');
});
