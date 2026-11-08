'use strict';
// The persistent staged server shared by the pack test and the ANU world server: loader base libraries plus
// an incremental `-s server` packwiz install. Neutral ops tooling: no test or probe logic lives here.
// Loader download and pack install primitives still live in server_smoke/runtime (setup.cjs, runtime.cjs).
const fs = require('node:fs');
const path = require('node:path');
const { ensureLoaderBase, prepareRunDir, installPack } = require('../testing/server_smoke/runtime/setup.cjs');
const { readStamp } = require('../testing/server_smoke/runtime/runtime.cjs');

// The staged server: loader base libraries plus an incremental `-s server` packwiz install. Never booted,
// so its files stay exactly what packwiz installed. A stage is reused only when its runtime.json names
// this runtime; one without a stamp, or stamped for another runtime, is rebuilt from the base.
async function ensureStage(stageDir, { cache, runtime, java, pack, log, scope, seed, port, heap }) {
  const base = await ensureLoaderBase(cache, runtime, java, log, scope);
  const stamp = readStamp(stageDir);
  if (fs.existsSync(stageDir) && (!stamp || stamp.id !== runtime.id || stamp.java !== runtime.java)) {
    if (fs.existsSync(path.join(stageDir, '.git'))) throw new Error(`refusing to rebuild ${stageDir}: it is a checkout`);
    log(`stage ${stageDir} was built for ${stamp ? stamp.id : 'an unknown runtime'}; rebuilding for ${runtime.id}`);
    fs.rmSync(stageDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
  if (!fs.existsSync(path.join(stageDir, 'libraries'))) prepareRunDir(base, stageDir, port, heap, seed);
  await installPack(stageDir, pack, java, cache, log, scope);
  return stageDir;
}

module.exports = { ensureStage };
