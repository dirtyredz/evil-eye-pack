'use strict';
// Prepare an isolated, exact server install using cached bytes only. Never runs an installer.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseIndex, readMetafileDownload } = require('../packwiz/pack_index.cjs');
const { makeRunServer } = require('../pack_test/session/prepare.cjs');

function inventory(root, cache) {
  const index = parseIndex(fs.readFileSync(path.join(root, 'index.toml'), 'utf8'));
  const files = [];
  for (const f of index.files) {
    if (!f.metafile) { files.push({ from: path.join(root, f.file), rel: f.file }); continue; }
    const text = fs.readFileSync(path.join(root, f.file), 'utf8');
    if (/^side = "client"$/m.test(text)) continue;
    const m = readMetafileDownload(text);
    const rel = path.posix.join(path.posix.dirname(f.file), m.filename);
    if (!m.filename || /[\\/]/.test(m.filename)) throw new Error('Invalid filename: ' + f.file);
    const from = path.join(cache, rel);
    if (!fs.existsSync(from)) throw new Error('Missing offline input (no download attempted): ' + from);
    const hash = crypto.createHash(m.hashFormat).update(fs.readFileSync(from)).digest('hex');
    if (hash !== m.hash) throw new Error('Cached input differs from pin: ' + rel);
    files.push({ from, rel, hash, hashFormat: m.hashFormat });
  }
  return files;
}
function prepare(root, cache, server, options) {
  if (fs.existsSync(server)) throw new Error('Refusing to reuse run server: ' + server);
  const files = inventory(root, cache);
  if (!fs.existsSync(path.join(cache, 'libraries'))) throw new Error('Missing cached Forge libraries: ' + cache);
  makeRunServer(cache, server, options);
  // Only delete explicit children of the new disposable copy. No cached path is ever mutated.
  for (const dir of ['mods', 'kubejs', 'config', 'defaultconfigs', 'resourcepacks', 'shaderpacks']) {
    const target = path.resolve(server, dir);
    if (path.dirname(target) !== path.resolve(server)) throw new Error('Unsafe run path');
    fs.rmSync(target, { recursive: true, force: true });
  }
  for (const f of files) {
    const dest = path.resolve(server, f.rel);
    if (!dest.startsWith(path.resolve(server) + path.sep)) throw new Error('Unsafe indexed path');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.from, dest);
  }
  fs.appendFileSync(path.join(server, 'server.properties'), 'level-type=minecraft:flat\ngenerate-structures=false\nspawn-monsters=false\nspawn-animals=false\nspawn-npcs=false\n');
  return files.filter(f => f.hash).map(({ rel, hash, hashFormat }) => ({ rel, hash, hashFormat }));
}
module.exports = { inventory, prepare };
