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
 try {fs.mkdirSync(path.join(root,'mods'));fs.writeFileSync(path.join(root,'mods/missing.pw.toml'),'name="Missing"\nfilename = "missing.jar"\n[download]\nhash-format = "sha256"\nhash = "'+'0'.repeat(64)+'"\nmode = "metadata:local"\n');
 const r=audit(root,[]);assert.equal(r.complete,false);assert.equal(r.errors.length,1);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});

const {profile}=require('../targets.cjs');
test('wave 7 recognizes each candidate in nested references and dependency metadata',()=>{
 const selected=profile('wave7'), r=result();
 const metadata='[[mods]]\nmodId="consumer"\nversion="1"\n[[dependencies.consumer]]\nmodId="createdrawerscompat"\ntype="required"\n';
 scanArchive(zip({'nested/a.jar':zip({'META-INF/neoforge.mods.toml':metadata,'x.class':klass([
  'dev.createdrawerscompat.Drawer','com/illusivesoulworks/polymorph/api/Test',
  'fuzs/diagonalblocks/Test','net/dadamalda/create_compatible_storage/Test'
 ])})}),'root.jar','root',r,0,selected.definitions);
 assert.deepEqual(r.archives[1].references.map(r=>r.kind).sort(),['compatible','diagonal','drawers','polymorph']);
 assert.equal(r.archives[1].metadata[0].mods[0].dependencies[0].type,'required');
 assert.throws(()=>profile('misspelled'),/Unknown/);
 assert.deepEqual(profile().targets,['ipn','kotlin']);
});

function fixtureAudit(t, jars, selected, removed=new Set(selected.remove)) {
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'closure-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.mkdirSync(path.join(root,'mods'));
 for(const [name, bytes] of Object.entries(jars)) {
  fs.writeFileSync(path.join(root,name+'.jar'),bytes);
  fs.writeFileSync(path.join(root,'mods',name+'.pw.toml'),`name="${name}"\nfilename = "${name}.jar"\n[download]\nhash-format = "sha256"\nhash = "${crypto.createHash('sha256').update(bytes).digest('hex')}"\nmode = "metadata:local"\n`);
 }
 const result=audit(root,[root],removed,selected); if(result.errors.length) t.diagnostic(JSON.stringify(result.errors)); return result;
}
const mod=id=>'[[mods]]\nmodId="'+id+'"\nversion="1"\n';
test('physical exclusion removes addon self references but not nested reverse consumers',t=>{
 const jars={
  'create-storage-drawers-compat':zip({'META-INF/neoforge.mods.toml':mod('createdrawerscompat'),'self.class':klass(['dev/createdrawerscompat/Self'])}),
  consumer:zip({'nested.jar':zip({'META-INF/neoforge.mods.toml':mod('consumer')+'[[dependencies.consumer]]\nmodId="createdrawerscompat"\ntype="optional"\n','use.class':klass(['dev.createdrawerscompat.Api'])})})
 };
 const r=fixtureAudit(t,jars,profile('wave7-drawers'));
 assert.equal(r.complete,true);assert.equal(r.verdict.safe,false);
 assert.equal(r.consumers.drawers.length,1);assert.equal(r.consumers.drawers[0].root,'consumer.pw.toml');
 assert.equal(r.consumers.drawers[0].dependencies[0].dependency.type,'optional');
 assert.equal(r.pins.find(p=>p.metafile==='create-storage-drawers-compat.pw.toml').excludedFromRetainedScan,true);
 assert.ok(r.archives.some(a=>a.path==='consumer.jar!nested.jar'));
});
test('optional metadata alone is not a hard removal blocker; required metadata is',t=>{
 for(const type of ['optional','required']) {
  const r=fixtureAudit(t,{consumer:zip({'META-INF/neoforge.mods.toml':mod('consumer')+'[[dependencies.consumer]]\nmodId="createdrawerscompat"\ntype="'+type+'"\n'})},profile('wave7-drawers'));
  assert.equal(r.verdict.safe,type==='optional');
 }
});
test('duplicate target providers and empty metadata fail closed',t=>{
 const nested=zip({'META-INF/neoforge.mods.toml':mod('createdrawerscompat')});
 const r=fixtureAudit(t,{one:nested,two:zip({'nested.jar':nested})},profile('wave7'));
 assert.equal(r.complete,false);assert.equal(r.duplicateProviders[0].providers.length,2);
 const bad=fixtureAudit(t,{bad:zip({'META-INF/neoforge.mods.toml':'nonsense'})},profile('wave7'));
 assert.equal(bad.complete,false);assert.match(bad.errors[0].error,/Empty mod metadata/);
});
test('missing or malformed declared nested archives fail closed',()=>{
 for (const metadata of ['broken','{}','{"jars":[{"path":"missing.jar"}]}'])
  assert.throws(()=>scanArchive(zip({'META-INF/jarjar/metadata.json':metadata}),'x','x',result()));
});
