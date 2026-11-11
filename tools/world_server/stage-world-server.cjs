#!/usr/bin/env node
'use strict';
// Builds the persistent world server's files (loader libraries + `packwiz -s server` mods/config/kubejs)
// into a directory on Valhalla, using the shared tools/server_stage/stage.cjs. No world, no server.properties
// opinions beyond the pack-test defaults: anu-world-server.ps1 ships this folder to ANU and writes the real
// settings there. Usage: node stage-world-server.cjs --out <dir> --private-cache <dir of <sha256>.jar> [--pack <pack.toml>]
const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '../..');
const T = (p) => require(path.join(ROOT, 'tools', p));

async function main(argv) {
  const opt = {};
  for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];
  if (!opt.out || !opt['private-cache']) throw new Error('usage: --out <dir> --private-cache <dir> [--pack <pack.toml>]');
  const pack = path.resolve(opt.pack || path.join(ROOT, 'pack.toml'));
  process.env.SMOKE_MIGRATION_MODS = path.resolve(opt['private-cache']); // read by runtime_env/env.cjs
  const env = T('runtime_env/env.cjs');
  const procs = T('runtime_env/procs.cjs');
  const { readRuntime, javaPaths } = T('runtime_env/server/runtime.cjs');
  const { ensureStage } = T('server_stage/stage.cjs');
  const runtime = readRuntime(pack);
  const { java } = javaPaths(runtime, env.JAVAS);
  const cache = path.join(env.ARTIFACTS, 'server-smoke/cache');
  const log = (m) => console.log(`[stage-world-server] ${m}`);
  const scope = procs.scope();
  try {
    await ensureStage(path.resolve(opt.out), { cache, runtime, java, pack, log, scope, seed: 1, port: 25565, heap: '6G' });
  } finally { scope.killAll(); }
  const mods = T('server_stage/mod-set.cjs').verifyStagedMods(path.dirname(pack), path.resolve(opt.out));
  fs.writeFileSync(path.join(path.resolve(opt.out), 'world-server-stage.json'), JSON.stringify({ version: 1, runtime: runtime.id, built: new Date().toISOString(), mods }) + '\n');
  log(`staged ${runtime.id} in ${path.resolve(opt.out)}`);
}
main(process.argv.slice(2)).catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1; });
