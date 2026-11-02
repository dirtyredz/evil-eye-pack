'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {copy,files}=require('./copy.cjs');
const {output}=require('../data_io/path_guard.cjs');
const {verify}=require('./snapshot.cjs');
const {prepare}=require('../server_smoke/runtime/offline_server.cjs');
const {prepareRunDir}=require('../server_smoke/runtime/setup.cjs');
const {parseIndex,readMetafileSide}=require('../packwiz/pack_index.cjs');
const {resolvePinnedJar}=require('../packwiz/pinned_jar.cjs');
const {readRuntime,writeStamp}=require('../server_smoke/runtime/runtime.cjs');
const {boot}=require('../server_smoke/process/boot.cjs');
const {waitForServer}=require('../server_smoke/process/host_wait.cjs');
const {localLock}=require('../pack_test/session/lock.cjs');
const procs=require('../server_smoke/process/procs.cjs');
const {WORLD}=require('../pack_test/stage_runtime.cjs');
// Compose a private offline cache. Neither shared caches nor instances receive stamps or writes.
function stage({root,loader,jarDirs,job,name}) {
  if(!/^[a-z][a-z0-9-]*$/.test(name))throw new Error('Invalid stage name');
  const dest=path.join(job,name+'-inputs');output(dest,job);
  if(fs.existsSync(dest))throw new Error('Inputs already exist: '+dest);
  const runtime=readRuntime(path.join(root,'pack.toml'));
  if(!fs.existsSync(path.join(loader,runtime.argsFile)))throw new Error('Missing exact loader '+runtime.argsFile);
  files(loader);prepareRunDir(loader,dest,25621,'8G','20261020');writeStamp(dest,runtime);
  const pins=[];
  for(const f of parseIndex(fs.readFileSync(path.join(root,'index.toml'),'utf8')).files) {
    if(!f.metafile)continue;
    const text=fs.readFileSync(path.join(root,f.file),'utf8');if(readMetafileSide(text)==='client')continue;
    const dir=path.posix.dirname(f.file),jar=resolvePinnedJar(text,jarDirs.map(d=>path.join(d,dir)),f.file);
    const target=path.join(dest,dir,jar.filename);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(jar.path,target);
    pins.push({metafile:f.file,filename:jar.filename,hash:jar.hash,hashFormat:jar.hashFormat,source:jar.path});
  }
  fs.writeFileSync(path.join(dest,'pins.json'),JSON.stringify(pins,null,2)+'\n');return dest;
}
async function trialBoot({root,cache,job,name,targets,restart=false,coverage=null,players=[]}) {
  if(!/^[a-z][a-z0-9-]*$/.test(name))throw new Error('Invalid run name');
  if(!Array.isArray(targets)||targets.length>20000||targets.some(t=>!Number.isInteger(t.x)||!Number.isInteger(t.z)||!/^[a-z][\w.-]*:[\w./-]+$/.test(t.dimension)))throw new Error('Invalid or unbounded targets');
  const server=path.join(job,name+'-server');output(server,job);
  const record=JSON.parse(fs.readFileSync(path.join(job,'source-manifest.json'),'utf8'));
  verify(record.source,record.files);verify(record.snapshot,record.files);
  const scope=procs.scope(),token=crypto.randomUUID(),label=restart?'restart':'conversion';let lock;
  const stop=()=>scope.killAll();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try {
    lock=localLock(path.join(job,'server.lock'),{owner:name});
    if(!restart) {
      prepare(root,cache,server,{profile:'ordinary',runtime:readRuntime(path.join(root,'pack.toml')),seed:'20261020',port:25621,heap:'8G'});
      copy(record.snapshot,path.join(server,WORLD),job);
      for(const rel of files(path.join(server,WORLD)))fs.chmodSync(path.join(server,WORLD,rel),0o644);
    } else {files(server);if(!fs.existsSync(path.join(server,WORLD,'level.dat')))throw new Error('Missing restart world');}
    const script=path.join(server,'kubejs/server_scripts/world_trial/capture.js');fs.mkdirSync(path.dirname(script),{recursive:true});fs.copyFileSync(path.join(__dirname,'probe/capture.js'),script);
    fs.copyFileSync(path.join(__dirname,'probe/players.js'),path.join(path.dirname(script),'players.js'));
    fs.writeFileSync(path.join(server,'world-trial-input.json'),JSON.stringify({token,targets,coverage,players}));
    const complete=path.join(server,'world-trial-complete.json');if(fs.existsSync(complete))fs.unlinkSync(complete);
    await waitForServer(scope);
    const stopRequest=path.join(server,'world-trial-stop-request');
    if(fs.existsSync(stopRequest))throw new Error('Remove the previous stop request before a new boot');
    const result=await boot(server,{priority:'AboveNormal',sample:10,silent:180,timeout:3600,completeTimeout:3000,complete:()=>fs.existsSync(stopRequest)||(fs.existsSync(complete)&&JSON.parse(fs.readFileSync(complete,'utf8')).token===token)},console.log,{scope});
    let evidence=path.join(job,name+'-'+label),attempt=1;
    while(fs.existsSync(evidence))evidence=path.join(job,name+'-'+label+'-'+(++attempt));
    output(evidence,job);fs.mkdirSync(evidence,{recursive:false});
    for(const rel of ['console.log','world-trial-registries.json','world-trial-complete.json','world-trial-players.json','world-trial-colony.json'])if(fs.existsSync(path.join(server,rel)))fs.copyFileSync(path.join(server,rel),path.join(evidence,rel));
    for(const rel of ['logs','crash-reports'])if(fs.existsSync(path.join(server,rel)))copy(path.join(server,rel),path.join(evidence,rel),job);
    fs.writeFileSync(path.join(evidence,'boot.json'),JSON.stringify({...result,token,targets:targets.length,coverage},null,2)+'\n');
    if(!result.completed||result.crashed||result.killed||result.wallSeconds===null)throw new Error('Boot failed: '+path.join(evidence,'boot.json'));
    if(fs.existsSync(stopRequest)||!fs.existsSync(complete))throw new Error('Trial stopped without complete probe: '+evidence);
    const probe=JSON.parse(fs.readFileSync(complete,'utf8'));if(probe.errors.length||probe.visited.length!==targets.length)throw new Error('Probe incomplete: '+complete);
    const playerResult=JSON.parse(fs.readFileSync(path.join(server,'world-trial-players.json'),'utf8'));
    if(playerResult.token!==token||playerResult.errors.length||playerResult.players.length!==players.length)throw new Error('Player round-trip incomplete: '+evidence);
    return {server,evidence,result};
  }finally{scope.killAll();lock?.release();process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);verify(record.source,record.files);verify(record.snapshot,record.files);}
}
module.exports={stage,trialBoot};
