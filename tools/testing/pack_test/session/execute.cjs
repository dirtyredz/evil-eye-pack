'use strict';
// One boot of a prepared run server: inject the probe, boot until the probe's manifest appears (or the
// watchdog/deadline ends it), stop, then copy the evidence out and drop the server copy.
// Shared by the local target (run.cjs) and the ANU agent (remote/agent.cjs).
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('../../server_smoke/process/boot.cjs');
const { manifestReady } = require('../verdict/protocol.cjs');
const { makeRunServer, injectProbe } = require('./prepare.cjs');
const { worldKey, restoreWorld, saveWorld } = require('./world_cache.cjs');
const { WORLD } = require('../stage_runtime.cjs');
const { withStaged } = require('../../../runtime_env/staged_dir.cjs');

// The files analysis needs, copied out of the server dir (relative source -> relative destination).
const EVIDENCE = [
  ['pack_test/out', 'probe'],
  ['logs/latest.log', 'logs/latest.log'],
  ['logs/kubejs/server.log', 'logs/kubejs-server.log'],
  ['console.log', 'logs/console.log'],
  ['crash-reports', 'crash-reports'],
  ['stall-threads.txt', 'logs/stall-threads.txt'],
  // Configs as the mods left them after loading (missing keys added, invalid values reset to defaults), so
  // a pack's shipped configs can be reconciled against the running mods' own schema without another boot.
  ['config', 'post-boot/config'],
  [`${WORLD}/serverconfig`, 'post-boot/serverconfig']
];

function collectEvidence(serverDir, evidenceDir) {
  for (const [from, to] of EVIDENCE) {
    const src = path.join(serverDir, from);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(evidenceDir, to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
  }
}

// o: { runtime, stageDir, runDir, worldCache, input, seed, port, heap, boot: {priority, sample, silent, timeout, probeTimeout},
//      keepServer, java, jcmd, scope, bootImpl (tests) }. runtime is the pack's descriptor, carried explicitly
//      (local run or ANU job) and verified against the server's runtime.json by boot(). Returns { boot, world: {key, reused, saved}, timings }.
// The per-run server copy is deleted on every exit (success, error, signal) unless keepServer; evidence stays.
async function execute(o, log) {
  if (!o.runtime) throw new Error('execute needs the run runtime descriptor');
  const serverDir = path.join(o.runDir, 'server');
  return withStaged({ runDir: o.runDir, dirs: [serverDir], keep: o.keepServer, log }, () => runOnServer(o, log, serverDir));
}

async function runOnServer(o, log, serverDir) {
  const evidenceDir = path.join(o.runDir, 'evidence');
  const timings = {};
  let t = Date.now();
  makeRunServer(o.stageDir, serverDir, o);
  const key = worldKey(o.stageDir, o.seed, o.runtime);
  const reused = !o.freshWorld && restoreWorld(o.worldCache, key, serverDir);
  injectProbe(serverDir, o.input);
  timings.copy = (Date.now() - t) / 1000;
  log(`run server ready (${reused ? `cached world ${key}` : 'fresh world'}); booting`);
  t = Date.now();
  const outDir = path.join(serverDir, 'pack_test/out');
  let result;
  try {
    result = await (o.bootImpl || boot)(serverDir, { ...o.boot, complete: () => manifestReady(outDir, o.input.token), completeTimeout: o.boot.probeTimeout }, log,
      { scope: o.scope, java: o.java, jcmd: o.jcmd, runtime: o.runtime, checkJava: o.checkJava });
  } finally {
    timings.boot = (Date.now() - t) / 1000;
    collectEvidence(serverDir, evidenceDir);
  }
  let saved = false;
  if (result.completed && !reused) {
    try { saved = saveWorld(o.worldCache, key, serverDir); } catch (e) { log(`world cache not saved: ${e.message}`); }
  }
  return { boot: result, world: { key, reused, saved }, timings };
}

module.exports = { execute, collectEvidence, EVIDENCE };
