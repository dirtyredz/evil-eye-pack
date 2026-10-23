'use strict';
// The generated-world cache. A world is reused by later runs with the same mods and seed (spawn-area
// generation is the slowest part of a boot and says nothing about recipes, tags or loot).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const WORLD = 'smoke-world';

function worldKey(stageDir, seed) {
  const mods = fs.readdirSync(path.join(stageDir, 'mods')).filter((f) => f.endsWith('.jar')).sort().join('\n');
  return crypto.createHash('sha256').update(`${seed}\n${mods}`).digest('hex').slice(0, 16);
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

module.exports = { worldKey, restoreWorld, saveWorld, WORLD };
