'use strict';
// Before the boot: the persistent staged server (incremental packwiz install), the per-run server copy
// (hard-linked jars) and probe injection. Run identity is run_meta.cjs, the world cache world_cache.cjs.
// Used on Valhalla by run.cjs and on ANU by remote/agent.cjs, so it depends only on Node and server_smoke.
const fs = require('node:fs');
const path = require('node:path');
const { ensureForgeBase, prepareRunDir, installPack } = require('../../server_smoke/setup.cjs');
const { WORLD } = require('./world_cache.cjs');

const PROBE_DIR = path.join(__dirname, '../probe');

// The staged server: Forge base libraries plus an incremental `-s server` packwiz install. Never booted,
// so its files stay exactly what packwiz installed.
async function ensureStage(stageDir, { cache, java, pack, log, scope, seed, port, heap }) {
  const base = await ensureForgeBase(cache, java, log, scope);
  if (!fs.existsSync(path.join(stageDir, 'libraries'))) prepareRunDir(base, stageDir, port, heap, seed);
  await installPack(stageDir, pack, java, cache, log, scope);
  return stageDir;
}

const STAGE_SKIP = new Set([WORLD, 'logs', 'crash-reports', 'pack_test', 'packwiz-install.log', 'console.log']);

// The run's own server copy. Jars are hard-linked (the server only reads them); everything else is copied.
function makeRunServer(stageDir, serverDir, { seed, port, heap }) {
  fs.mkdirSync(serverDir, { recursive: true });
  for (const e of fs.readdirSync(stageDir, { withFileTypes: true })) {
    if (STAGE_SKIP.has(e.name)) continue;
    const from = path.join(stageDir, e.name);
    const to = path.join(serverDir, e.name);
    if (e.name === 'mods' && e.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      for (const f of fs.readdirSync(from)) {
        try { fs.linkSync(path.join(from, f), path.join(to, f)); } catch { fs.copyFileSync(path.join(from, f), path.join(to, f)); }
      }
    } else fs.cpSync(from, to, { recursive: true });
  }
  fs.writeFileSync(path.join(serverDir, 'server.properties'), [
    `level-seed=${seed}`, 'online-mode=false', 'server-ip=127.0.0.1', `server-port=${port}`, `level-name=${WORLD}`,
    'enable-rcon=false', 'enable-query=false', 'max-tick-time=-1', 'motd=pack-test', 'spawn-protection=0', ''
  ].join('\n'));
  fs.writeFileSync(path.join(serverDir, 'user_jvm_args.txt'), `-Xmx${heap}\n-Xms1G\n`);
}

// Copies the probe scripts into the run's server and writes its inputs. Never touches a checkout.
function injectProbe(serverDir, input) {
  const scripts = path.join(serverDir, 'kubejs/server_scripts/pack_test');
  fs.mkdirSync(scripts, { recursive: true });
  for (const f of fs.readdirSync(PROBE_DIR).filter((x) => x.endsWith('.js'))) fs.copyFileSync(path.join(PROBE_DIR, f), path.join(scripts, f));
  fs.mkdirSync(path.join(serverDir, 'pack_test/in'), { recursive: true });
  fs.mkdirSync(path.join(serverDir, 'pack_test/out'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'pack_test/in/run.json'), JSON.stringify(input));
}

module.exports = { ensureStage, makeRunServer, injectProbe };
