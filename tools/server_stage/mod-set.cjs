'use strict';
// Metadata-only server inventory, shared by staging and the deployed-world parity gate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const P = require('../packwiz/pack_index.cjs');

function serverMods(root) {
  const ref = P.readPackIndexRef(fs.readFileSync(path.join(root, 'pack.toml'), 'utf8'));
  const index = P.parseIndex(fs.readFileSync(path.join(root, ref.file || 'index.toml'), 'utf8'));
  const mods = [];
  for (const entry of index.files) {
    if (!entry.file.startsWith('mods/')) continue;
    if (entry.file.includes('\\') || entry.file.split('/').includes('..')) throw Error('Unsafe mod path: ' + entry.file);
    if (!entry.metafile) {
      if (entry.file.endsWith('.jar')) mods.push({ file: entry.file.slice(5), hashFormat: index.hashFormat, hash: entry.hash });
      continue;
    }
    const text = fs.readFileSync(path.join(root, entry.file), 'utf8');
    const side = P.readMetafileSide(text);
    if (!['client', 'both', 'server'].includes(side)) throw Error('Invalid mod side: ' + entry.file);
    if (side === 'client') continue;
    const pin = P.readMetafileDownload(text);
    mods.push({ file: path.posix.join(path.posix.dirname(entry.file).slice(5), pin.filename), hashFormat: pin.hashFormat, hash: pin.hash });
  }
  return validateMods(mods);
}

function validateMods(mods) {
  if (!Array.isArray(mods)) throw Error('Invalid server mod manifest: mods must be an array');
  const seen = new Set();
  const lengths = { sha256: 64, sha512: 128, sha1: 40, md5: 32 };
  for (const m of mods) {
    if (!m || typeof m.file !== 'string' || !m.file.endsWith('.jar') || m.file.startsWith('/') || /[:\\]/.test(m.file) || m.file.split('/').includes('..') ||
        !lengths[m.hashFormat] || typeof m.hash !== 'string' || !new RegExp(`^[a-f0-9]{${lengths[m.hashFormat]}}$`).test(m.hash)) {
      throw Error('Invalid server mod manifest entry');
    }
    if (seen.has(m.file.toLowerCase())) throw Error('Duplicate server jar: ' + m.file);
    seen.add(m.file.toLowerCase());
  }
  return [...mods].sort((a, b) => a.file.localeCompare(b.file));
}

function compareMods(expected, deployed) {
  validateMods(expected); validateMods(deployed);
  const key = m => `${m.file}\0${m.hashFormat}\0${m.hash}`;
  const want = new Set(expected.map(key)), have = new Set(deployed.map(key));
  return {
    added: expected.filter(m => !have.has(key(m))).map(m => m.file).sort(),
    removed: deployed.filter(m => !want.has(key(m))).map(m => m.file).sort()
  };
}

function verifyStagedMods(root, stageDir) {
  const expected = serverMods(root);
  const actual = [];
  const modsDir = path.join(stageDir, 'mods');
  function walk(dir, rel = '') {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.posix.join(rel, d.name);
      if (d.isSymbolicLink()) throw Error('Linked staged mod: ' + file);
      if (d.isDirectory()) walk(path.join(dir, d.name), file);
      else if (d.name.endsWith('.jar')) actual.push(file);
    }
  }
  walk(modsDir);
  const names = new Set(expected.map(m => m.file));
  const extras = actual.filter(f => !names.has(f));
  if (extras.length) throw Error('Unexpected staged server jars: ' + extras.join(', '));
  for (const m of expected) {
    const bytes = fs.readFileSync(path.join(modsDir, m.file));
    if (crypto.createHash(m.hashFormat).update(bytes).digest('hex') !== m.hash) throw Error('Staged server jar differs from pin: ' + m.file);
  }
  return expected;
}

module.exports = { serverMods, validateMods, compareMods, verifyStagedMods };
