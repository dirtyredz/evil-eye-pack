'use strict';
// Before the boot: artifact destinations, run metadata, the persistent staged server (incremental packwiz
// install), the per-run server copy (hard-linked jars, cached world) and probe injection.
// Used on Valhalla by run.cjs and on ANU by remote/agent.cjs, so it depends only on Node and server_smoke.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { ensureForgeBase, prepareRunDir, installPack } = require('../server_smoke/setup.cjs');

const PROBE_DIR = path.join(__dirname, 'probe');
const WORLD = 'smoke-world';

const norm = (p) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const inside = (child, parent) => norm(child) === norm(parent) || norm(child).startsWith(`${norm(parent)}/`);

// Writable run folders must sit under the artifacts root and never inside a checkout.
function checkDestination(dir, { artifacts, checkouts }) {
  if (!inside(dir, artifacts)) throw new Error(`refusing to write outside the artifacts root ${artifacts}: ${dir}`);
  for (const c of checkouts) if (inside(dir, c)) throw new Error(`refusing to write inside a checkout (${c}): ${dir}`);
}

const runId = (d = new Date()) => `run-${d.toISOString().replace(/[:.]/g, '-')}`;

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function git(root, args) {
  try { return execFileSync('git', args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

// What was tested: checkout commit, dirty state and the pack/index hashes.
function runMeta(packToml) {
  const root = path.dirname(packToml);
  const read = (f) => (fs.existsSync(f) ? sha256(fs.readFileSync(f)) : null);
  return {
    checkout: root.replace(/\\/g, '/'),
    commit: git(root, ['rev-parse', 'HEAD']),
    branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: !!git(root, ['status', '--porcelain', '--untracked-files=no']),
    packSha256: read(packToml),
    indexSha256: read(path.join(root, 'index.toml'))
  };
}

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

// A generated world is reused by later runs with the same mods and seed (spawn-area generation is the
// slowest part of a boot and says nothing about recipes, tags or loot).
function worldKey(stageDir, seed) {
  const mods = fs.readdirSync(path.join(stageDir, 'mods')).filter((f) => f.endsWith('.jar')).sort().join('\n');
  return sha256(`${seed}\n${mods}`).slice(0, 16);
}

function restoreWorld(worldCache, key, serverDir) {
  const src = path.join(worldCache, key, WORLD);
  if (!fs.existsSync(src)) return false;
  fs.cpSync(src, path.join(serverDir, WORLD), { recursive: true });
  return true;
}

function saveWorld(worldCache, key, serverDir) {
  const dest = path.join(worldCache, key, WORLD);
  const src = path.join(serverDir, WORLD);
  if (fs.existsSync(dest) || !fs.existsSync(src)) return false;
  const tmp = `${dest}.tmp-${process.pid}`;
  fs.cpSync(src, tmp, { recursive: true });
  fs.renameSync(tmp, dest);
  return true;
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

// Text files a player receives (configs, KubeJS) that still name a removed mod.
function shippedMentions(serverDir, namespaces) {
  const { namespaceMentions } = require('./resources.cjs');
  const out = [];
  const re = new RegExp(`(?:${namespaces.join('|')}):`);
  for (const dir of ['config', 'defaultconfigs', 'kubejs']) {
    const abs = path.join(serverDir, dir);
    if (!fs.existsSync(abs)) continue;
    for (const e of fs.readdirSync(abs, { recursive: true, withFileTypes: true })) {
      if (!e.isFile() || !/\.(json|json5|toml|cfg|txt|js|properties|yaml|yml)$/.test(e.name)) continue;
      const file = path.join(e.parentPath, e.name);
      const text = fs.readFileSync(file, 'utf8');
      if (!re.test(text)) continue;
      const refs = [...new Set((text.match(new RegExp(`(?:${namespaces.join('|')}):[a-z0-9_/.-]+`, 'g')) || []))];
      out.push({ file: path.relative(serverDir, file).replace(/\\/g, '/'), refs: refs.length ? refs : namespaceMentions(text, namespaces) });
    }
  }
  return out;
}

module.exports = { checkDestination, runId, runMeta, ensureStage, makeRunServer, worldKey, restoreWorld, saveWorld, injectProbe, shippedMentions, WORLD };
