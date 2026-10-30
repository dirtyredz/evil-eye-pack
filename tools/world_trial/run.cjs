'use strict';
const fs=require('node:fs'),path=require('node:path');
const {output,inside}=require('./copy.cjs');
const {snapshot,verify}=require('./snapshot.cjs');
const {inventory,json}=require('./inventory.cjs');
const {compare}=require('./compare.cjs');
const {waitForServer}=require('../server_smoke/host_wait.cjs');
const procs=require('../server_smoke/procs.cjs');
async function main(args) {
  const [command,...rest]=args,opts={};
  for(let i=0;i<rest.length;i+=2){if(!rest[i].startsWith('--')||!rest[i+1])throw new Error('Expected --option value');const key=rest[i].slice(2);if(!['job','source','root','cache','inventory','name','world','out','before','after','registries','loader','jars'].includes(key)||Object.hasOwn(opts,key))throw new Error('Unknown or repeated option: '+key);opts[key]=['name','jars'].includes(key)?rest[i+1]:path.resolve(rest[i+1]);}
  if(!opts.job)throw new Error('Required --job <artifact directory>');
  const job=opts.job;
  if(!inside(job,'C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs'))throw new Error('World trials must live under the artifact jobs directory');
  output(path.join(job,'guard'),job);
  if(command==='snapshot') {
    if(!opts.source)throw new Error('Required --source');
    const scope=procs.scope();try{await waitForServer(scope);const r=snapshot(opts.source,job);console.log('Snapshot verified: '+Object.keys(r.files).length+' files');}finally{scope.killAll();}
  }else if(command==='stage') {
    if(!opts.root||!opts.loader||!opts.jars||!opts.name)throw new Error('Required --root, --loader, --jars, --name');
    console.log(require('./boot.cjs').stage({root:opts.root,loader:opts.loader,jarDirs:opts.jars.split(';'),job,name:opts.name}));
  }else if(command==='boot'||command==='restart') {
    if(!opts.root||!opts.cache||!opts.inventory||!opts.name)throw new Error('Required --root, --cache, --inventory, --name');
    const inv=JSON.parse(fs.readFileSync(opts.inventory,'utf8'));
    if(inv.errors.length)throw new Error('Inventory is incomplete');
    const coverage=require('./probe/plan.cjs').plan(inv);
    const players=Object.keys(inv.data).filter(f=>/^playerdata\/[a-f0-9-]+\.dat$/.test(f)).map(f=>path.basename(f,'.dat'));
    await require('./boot.cjs').trialBoot({root:opts.root,cache:opts.cache,job,name:opts.name,targets:coverage.targets,coverage,players,restart:command==='restart'});
  }else if(command==='verify') {
    const r=JSON.parse(fs.readFileSync(path.join(job,'source-manifest.json'),'utf8'));
    console.log('Original:',verify(r.source,r.files));console.log('Snapshot:',verify(r.snapshot,r.files));
  }else if(command==='inventory') {
    if(!opts.world||!opts.out)throw new Error('Required --world and --out');output(opts.out,job);output(opts.out+'.semantics.json',job);
    const r=inventory(opts.world);fs.writeFileSync(opts.out,json(r)+'\n');fs.writeFileSync(opts.out+'.semantics.json',json(require('./semantics.cjs').semantics(r))+'\n');console.log(json({files:r.files,chunks:r.chunks,errors:r.errors,targets:r.targets.length,entities:r.entities.length,blockEntities:r.blockEntities.length,items:r.items.length}));
    if(r.errors.length)process.exitCode=2;
  }else if(command==='compare') {
    if(!opts.before||!opts.after||!opts.out)throw new Error('Required --before, --after, --out');output(opts.out,job);
    const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
    const r=compare(read(opts.before),read(opts.after),{registries:opts.registries?read(opts.registries):undefined});fs.writeFileSync(opts.out,json(r)+'\n');console.log(r.verdict+': '+r.differences.length+' differences');if(r.verdict!=='PASS')process.exitCode=1;
  }else throw new Error('Commands: snapshot, verify, stage, inventory, boot, restart, compare');
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.stack);process.exitCode=2;});
module.exports={main};
