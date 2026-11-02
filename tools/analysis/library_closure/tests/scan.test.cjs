'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const {strings}=require('../class_references.cjs');
const {scanArchive,audit}=require('../scan.cjs');
function klass(values) {
 const head=Buffer.alloc(10);head.writeUInt32BE(0xcafebabe);head.writeUInt16BE(65,6);head.writeUInt16BE(values.length+1,8);
 return Buffer.concat([head,...values.map(s=>{const b=Buffer.from(s),h=Buffer.alloc(3);h[0]=1;h.writeUInt16BE(b.length,1);return Buffer.concat([h,b]);}),Buffer.alloc(8)]);
}
function zip(entries) {
 const chunks=[],central=[];let offset=0;
 for(const [name,value] of Object.entries(entries)) {
  const n=Buffer.from(name),b=Buffer.isBuffer(value)?value:Buffer.from(value),h=Buffer.alloc(30),c=Buffer.alloc(46);
  h.writeUInt32LE(0x04034b50);h.writeUInt32LE(b.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);
  c.writeUInt32LE(0x02014b50);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);
  chunks.push(h,n,b);central.push(c,n);offset+=h.length+n.length+b.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(entries).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...chunks,cd,end]);
}
function result(){return {archives:[]};}
test('descriptors and reflection strings survive conservative constant-pool parsing',()=>{
 const values=['Lorg/anti_ad/Thing;','org.anti_ad.Other','local/Owner'];assert.deepEqual(strings(klass(values)),values);
 assert.throws(()=>strings(Buffer.from('bad')),/header/);assert.throws(()=>strings(klass(values).subarray(0,12)),/Truncated/);
});
test('all nested paths and duplicate basenames preserve archive ownership',()=>{
 const nested=zip({'x.class':klass(['org.anti_ad.Other'])});const r=result();
 scanArchive(zip({'arbitrary/a.jar':nested,'elsewhere/a.jar':nested,'org/anti_ad/Local.class':klass(['org/anti_ad/Missing'])}),'root.jar','root',r);
 assert.equal(r.archives.length,3);assert.notEqual(r.archives[1].path,r.archives[2].path);
 assert.equal(r.archives[0].references.length,1,'local definition must not suppress another class in the package');
 assert.ok(r.archives.slice(1).every(a=>a.references[0].kind==='ipn'));
});
test('nested metadata distinguishes required and optional consumers',()=>{
 const metadata='[[mods]]\nmodId="consumer"\nversion="1"\n[[dependencies.consumer]]\nmodId="libipn"\ntype="required"\nversionRange="*"\n[[dependencies.consumer]]\nmodId="kotlinforforge"\ntype="optional"\nversionRange="*"\n';
 const r=result();scanArchive(zip({'nested/dependency.jar':zip({'META-INF/neoforge.mods.toml':metadata})}),'root','root',r);
 const deps=r.archives[1].metadata[0].mods[0].dependencies;assert.equal(deps[0].type,'required');assert.equal(deps[1].type,'optional');
});
test('malformed and recursion-limited archives cannot count as complete',()=>{
 assert.throws(()=>scanArchive(zip({'bad.class':Buffer.from('bad')}),'x','x',result()),/header/);
 assert.throws(()=>scanArchive(zip({}),'x','x',result(),33),/Recursion/);
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'closure-'));
 try {fs.mkdirSync(path.join(root,'mods'));fs.writeFileSync(path.join(root,'mods/missing.pw.toml'),'name="Missing"\nfilename="missing.jar"\n[download]\nhash-format="sha256"\nhash="'+'0'.repeat(64)+'"\nmode="metadata:local"\n');
 const r=audit(root,[]);assert.equal(r.complete,false);assert.equal(r.errors.length,1);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
