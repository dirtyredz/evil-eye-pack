'use strict';
// Ownership of the dedup generator's outputs. `generated.json` (unshipped, beside this file) records each
// file the generator wrote with its sha256. A regeneration writes the new set, then deletes only files
// that the previous run wrote, that the new run no longer produces and whose bytes are still exactly what
// the generator wrote. Hand-written overrides are never in the manifest, so they always survive; an owned
// file someone edited by hand is kept and reported instead of deleted.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../data_io/files.cjs');

const MANIFEST = path.join(__dirname, 'generated.json');
const text = (json) => JSON.stringify(json, null, 2) + '\n';

function readManifest(file = MANIFEST) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { schema: 1, files: {} };
}

// outputs: Map<repo-relative path, JSON value>. Returns { writes, removes, kept } without touching disk.
function reconcile(root, previous, outputs) {
  const writes = [...outputs].map(([rel, json]) => ({ rel, text: text(json) })).sort((a, b) => (a.rel < b.rel ? -1 : 1));
  const removes = [], kept = [];
  for (const [rel, hash] of Object.entries(previous.files || {}).sort()) {
    if (outputs.has(rel)) continue;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    if (sha256(fs.readFileSync(abs)) === hash) removes.push(rel); else kept.push(rel);
  }
  return { writes, removes, kept };
}

// Applies a reconcile result and returns the new manifest (written to `file`).
function apply(root, result, file = MANIFEST) {
  const files = {};
  for (const w of result.writes) {
    const abs = path.join(root, w.rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, w.text);
    files[w.rel] = sha256(Buffer.from(w.text));
  }
  for (const rel of result.removes) {
    const abs = path.join(root, rel);
    fs.rmSync(abs);
    // Drop folders the generator emptied (one folder per mod under kubejs/data).
    for (let dir = path.dirname(abs); dir.startsWith(path.join(root, 'kubejs', 'data')) && dir !== path.join(root, 'kubejs', 'data') && !fs.readdirSync(dir).length; dir = path.dirname(dir)) fs.rmdirSync(dir);
  }
  const manifest = { schema: 1, files: Object.fromEntries(Object.entries(files).sort()) };
  fs.writeFileSync(file, text(manifest));
  return manifest;
}

module.exports = { MANIFEST, readManifest, reconcile, apply, text };
