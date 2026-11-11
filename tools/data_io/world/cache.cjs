'use strict';
// The generated-world cache. A world is reused only by a later run with the same runtime, seed,
// generation profile and byte-identical world-shaping content (spawn-area generation is the slowest part
// of a boot and says nothing about recipes, tags or loot). Each cached world carries the runtime stamp
// it was generated under, and restoring into a server of another runtime is refused.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../files.cjs');
const { readStamp, STAMP } = require('../../runtime_env/server/runtime.cjs');

const { WORLD } = require('../../server_stage/stage_runtime.cjs');
// Server content that can change generated terrain besides the jars themselves.
const CONTENT = ['config', 'defaultconfigs', 'kubejs/data'];

function files(dir, rel = '') {
  const abs = path.join(dir, rel);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? files(dir, r) : e.isFile() ? [r] : [];
  });
}

// runtime: the descriptor (or its stamp); profile: the world-generation profile name.
function worldKey(serverDir, seed, runtime, profile = 'ordinary') {
  if (!runtime || !runtime.id) throw new Error('worldKey needs the server runtime');
  const lines = [`world-key 2`, `runtime ${runtime.id} java ${runtime.java}`, `seed ${seed}`, `profile ${profile}`];
  for (const f of files(serverDir, 'mods').filter((r) => r.endsWith('.jar'))) lines.push(`${f}\t${sha256(fs.readFileSync(path.join(serverDir, f)))}`);
  for (const dir of CONTENT) for (const f of files(serverDir, dir)) lines.push(`${f}\t${sha256(fs.readFileSync(path.join(serverDir, f)))}`);
  return sha256(lines.join('\n')).slice(0, 16);
}

function restoreWorld(worldCache, key, serverDir) {
  const src = path.join(worldCache, key, WORLD);
  if (!fs.existsSync(src)) return false;
  const cached = readStamp(path.join(worldCache, key));
  const server = readStamp(serverDir);
  if (!cached || !server || cached.id !== server.id || cached.java !== server.java) {
    throw new Error(`cached world ${key} was generated under ${cached ? cached.id : 'an unrecorded runtime'}, not ${server ? server.id : 'an unstamped server'}; refusing to restore it`);
  }
  fs.cpSync(src, path.join(serverDir, WORLD), { recursive: true });
  return true;
}

function saveWorld(worldCache, key, serverDir) {
  const dest = path.join(worldCache, key, WORLD);
  const src = path.join(serverDir, WORLD);
  if (fs.existsSync(dest) || !fs.existsSync(src)) return false;
  const stamp = readStamp(serverDir);
  if (!stamp) throw new Error(`server ${serverDir} has no ${STAMP}; its world is not cached`);
  const tmp = `${dest}.tmp-${process.pid}`;
  fs.cpSync(src, tmp, { recursive: true });
  fs.writeFileSync(path.join(worldCache, key, STAMP), JSON.stringify(stamp, null, 1) + '\n');
  fs.renameSync(tmp, dest);
  return true;
}

module.exports = { worldKey, restoreWorld, saveWorld };
