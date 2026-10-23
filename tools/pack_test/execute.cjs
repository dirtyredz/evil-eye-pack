'use strict';
// One boot of a prepared run server: inject the probe, boot until the probe's manifest appears (or the
// watchdog/deadline ends it), stop, then copy the evidence out and drop the server copy.
// Shared by the local target (run.cjs) and the ANU agent (remote/agent.cjs).
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('../server_smoke/boot.cjs');
const { manifestReady } = require('./protocol.cjs');
const { makeRunServer, worldKey, restoreWorld, saveWorld, injectProbe } = require('./prepare.cjs');

// The files analysis needs, copied out of the server dir (relative source -> relative destination).
const EVIDENCE = [
  ['pack_test/out', 'probe'],
  ['logs/latest.log', 'logs/latest.log'],
  ['logs/kubejs/server.log', 'logs/kubejs-server.log'],
  ['console.log', 'logs/console.log'],
  ['crash-reports', 'crash-reports'],
  ['stall-threads.txt', 'logs/stall-threads.txt']
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

// o: { stageDir, runDir, worldCache, input, seed, port, heap, boot: {priority, sample, silent, timeout, probeTimeout},
//      keepServer, java, jcmd, scope }. Returns { boot, world: {key, reused, saved}, timings }.
async function execute(o, log) {
  const serverDir = path.join(o.runDir, 'server');
  const evidenceDir = path.join(o.runDir, 'evidence');
  const timings = {};
  let t = Date.now();
  makeRunServer(o.stageDir, serverDir, o);
  const key = worldKey(o.stageDir, o.seed);
  const reused = !o.freshWorld && restoreWorld(o.worldCache, key, serverDir);
  injectProbe(serverDir, o.input);
  timings.copy = (Date.now() - t) / 1000;
  log(`run server ready (${reused ? `cached world ${key}` : 'fresh world'}); booting`);
  t = Date.now();
  const outDir = path.join(serverDir, 'pack_test/out');
  let result;
  try {
    result = await boot(serverDir, { ...o.boot, complete: () => manifestReady(outDir, o.input.token), completeTimeout: o.boot.probeTimeout }, log,
      { scope: o.scope, java: o.java, jcmd: o.jcmd });
  } finally {
    timings.boot = (Date.now() - t) / 1000;
    collectEvidence(serverDir, evidenceDir);
  }
  let saved = false;
  if (result.completed && !reused) {
    try { saved = saveWorld(o.worldCache, key, serverDir); } catch (e) { log(`world cache not saved: ${e.message}`); }
  }
  if (!o.keepServer) fs.rmSync(serverDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  return { boot: result, world: { key, reused, saved }, timings };
}

module.exports = { execute, collectEvidence, EVIDENCE };
