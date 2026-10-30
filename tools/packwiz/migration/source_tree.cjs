'use strict';
// The lock's source pack after apply. Once the lock is applied the checkout is the target, so a later
// resolve (a new disposition: a port pin, an addition) re-reads the original source metafiles from the
// commit the lock records, exported from git into a scratch folder and checked against the fingerprint.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { listEntries, readEntry } = require('../../data_io/zip_reader.cjs');
const { FOLDERS, fingerprint } = require('./manifest.cjs');

// Writes the source files (metafile folders + pack.toml) of `commit` into `dest` and returns dest.
function exportSource(repo, commit, dest, { git = (args) => execFileSync('git', args, { cwd: repo, maxBuffer: 1 << 28 }) } = {}) {
  const present = String(git(['ls-tree', '--name-only', commit])).split('\n').filter(Boolean);
  const wanted = [...FOLDERS.filter((d) => present.includes(d)), 'pack.toml'];
  const zip = git(['archive', '--format=zip', commit, '--', ...wanted]);
  fs.rmSync(dest, { recursive: true, force: true });
  for (const e of listEntries(zip)) {
    if (e.name.endsWith('/')) continue;
    const file = path.join(dest, e.name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, readEntry(zip, e));
  }
  return dest;
}

// The folder to resolve from: an explicit root, else the checkout while it is still the lock's source,
// else the recorded source commit exported to `scratch` (it must reproduce the lock's fingerprint).
function sourceRoot({ root, explicitRoot, lock, scratch }) {
  if (explicitRoot) return { root: explicitRoot, commit: null };
  if (!lock || fingerprint(root) === lock.source?.fingerprint) return { root, commit: null };
  const commit = lock.source?.commit;
  if (!commit) throw new Error('the checkout is past the lock source and the lock records no source commit; pass --root <source tree>');
  const dir = exportSource(root, commit, scratch);
  const actual = fingerprint(dir);
  if (actual !== lock.source.fingerprint) throw new Error(`source commit ${commit} has fingerprint ${actual}, not the lock's ${lock.source.fingerprint}`);
  return { root: dir, commit };
}

module.exports = { exportSource, sourceRoot };
