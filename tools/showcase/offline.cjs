'use strict';
// Prepare an isolated, exact server install using cached bytes only. Never runs an installer.
const fs = require('node:fs');
const path = require('node:path');
const { parseIndex, readMetafileSide } = require('../packwiz/pack_index.cjs');
const { resolvePinnedJar } = require('../packwiz/pinned_jar.cjs');
const { makeRunServer } = require('../pack_test/session/prepare.cjs');

// World profiles: the showcase builds on an empty flat world; `ordinary` keeps the pack's
// normal world generation (used when measuring the pack itself, e.g. the mod map).
const PROFILES = {
  showcase: 'level-type=minecraft:flat\ngenerate-structures=false\nspawn-monsters=false\nspawn-animals=false\nspawn-npcs=false\n',
  ordinary: ''
};

function inventory(root, cache) {
  const index = parseIndex(fs.readFileSync(path.join(root, 'index.toml'), 'utf8'));
  const files = [];
  for (const f of index.files) {
    if (!f.metafile) { files.push({ from: path.join(root, f.file), rel: f.file }); continue; }
    const text = fs.readFileSync(path.join(root, f.file), 'utf8');
    if (readMetafileSide(text) === 'client') continue;
    const dir = path.posix.dirname(f.file);
    const jar = resolvePinnedJar(text, [path.join(cache, dir)], f.file);
    files.push({ from: jar.path, rel: path.posix.join(dir, jar.filename), hash: jar.hash, hashFormat: jar.hashFormat });
  }
  return files;
}
function prepare(root, cache, server, { profile = 'showcase', ...options }) {
  if (!Object.hasOwn(PROFILES, profile)) throw new Error('Unknown server profile: ' + profile);
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
  fs.appendFileSync(path.join(server, 'server.properties'), PROFILES[profile]);
  return files.filter(f => f.hash).map(({ rel, hash, hashFormat }) => ({ rel, hash, hashFormat }));
}
module.exports = { inventory, prepare, PROFILES };
