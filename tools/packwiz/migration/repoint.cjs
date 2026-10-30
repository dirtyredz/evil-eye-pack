'use strict';
// Deterministic metadata changes from a validated lock: render each target metafile in packwiz's
// own layout, plan every write/delete plus pack.toml's [versions], and apply all-or-nothing.
// A stale lock (source fingerprint mismatch) or any planning error fails before the first write.
// Index membership and hashes are rebuilt afterwards by rehash.cjs, never here.
const fs = require('node:fs');
const path = require('node:path');
const { fingerprint, sourceMetafiles, validate } = require('./manifest.cjs');

const q = (s) => JSON.stringify(String(s));

// packwiz metafile text for one target: Modrinth and direct downloads carry a URL; CurseForge uses
// metadata mode (the installer asks the API); only platform pins carry an [update] table. Modrinth
// pins use sha512 (packwiz's own choice for Modrinth), CurseForge sha1 (its API hash), direct sha256.
function renderMetafile(t) {
  const lines = [`name = ${q(t.name)}`, `filename = ${q(t.filename)}`, `side = ${q(t.side)}`, '', '[download]'];
  if (t.source === 'modrinth') lines.push(`url = ${q(t.url)}`, 'hash-format = "sha512"', `hash = ${q(t.sha512)}`);
  else if (t.source === 'curseforge') lines.push('hash-format = "sha1"', `hash = ${q(t.sha1)}`, 'mode = "metadata:curseforge"');
  else if (t.source === 'local') lines.push('mode = "metadata:local"', 'hash-format = "sha256"', `hash = ${q(t.sha256)}`);
  else lines.push(`url = ${q(t.url)}`, 'hash-format = "sha256"', `hash = ${q(t.sha256)}`);
  if (t.source === 'modrinth') lines.push('', '[update]', '[update.modrinth]', `mod-id = ${q(t.project)}`, `version = ${q(t.version)}`);
  if (t.source === 'curseforge') lines.push('', '[update]', '[update.curseforge]', `file-id = ${t.file}`, `project-id = ${t.project}`);
  return lines.join('\n') + '\n';
}

function renderVersions(packText, runtime) {
  const text = packText.replace(/\r\n/g, '\n');
  const re = /^\[versions\]\n(?:[^[\n].*\n?)*/m;
  if (!re.test(text)) throw new Error('pack.toml has no [versions] table');
  const table = `[versions]\nminecraft = ${q(runtime.minecraft)}\nneoforge = ${q(runtime.loaderVersion)}\n`;
  return text.replace(re, (m) => (m.endsWith('\n\n') ? `${table}\n` : table));
}

// The full change set: { writes: [{ rel, text }], deletes: [rel], summary } sorted by path.
function plan(root, lock) {
  const sources = sourceMetafiles(root);
  const errors = validate(lock, sources);
  if (errors.length) throw new Error(`lock is invalid:\n  ${errors.join('\n  ')}`);
  const actual = fingerprint(root);
  if (actual !== lock.source.fingerprint) throw new Error(`stale lock: source fingerprint ${actual} != lock ${lock.source.fingerprint}`);
  return changeSet(root, lock);
}

// The source metafiles a lock was built from.
const lockSources = (lock) => lock.entries.filter((e) => e.action !== 'add').map((e) => e.metafile);

// After apply: what still differs between this checkout and the lock's target state (pending writes or
// deletes, plus metafiles the lock does not know). [] means the lock is exactly applied.
function appliedDifferences(root, lock) {
  const errors = validate(lock, lockSources(lock));
  if (errors.length) return errors.map((e) => `lock is invalid: ${e}`);
  const c = changeSet(root, lock);
  const out = [...c.writes.map((w) => `${w.rel}: differs from the lock`), ...c.deletes.map((d) => `${d}: should be removed`)];
  const known = new Set(lock.entries.filter((e) => e.target).map((e) => e.target.metafile));
  for (const rel of sourceMetafiles(root)) if (!known.has(rel)) out.push(`${rel}: not in the lock`);
  return out.sort();
}

// An updated lock (a later disposition: a port pin, an addition) on an already-applied checkout. The lock
// must be valid against its own sources, and every metafile present must be one the lock accounts for, so
// nothing outside the lock is silently overwritten or kept.
function planApplied(root, lock) {
  const errors = validate(lock, lockSources(lock));
  if (errors.length) throw new Error(`lock is invalid:\n  ${errors.join('\n  ')}`);
  const known = new Set(lock.entries.flatMap((e) => [e.metafile, e.target?.metafile].filter(Boolean)));
  const unknown = sourceMetafiles(root).filter((rel) => !known.has(rel));
  if (unknown.length) throw new Error(`checkout has metafiles the lock does not account for:\n  ${unknown.join('\n  ')}`);
  return changeSet(root, lock);
}

// Writes and deletes that bring the checkout to the lock's target state (no validation).
function changeSet(root, lock) {
  const writes = [], deletes = [], summary = {};
  for (const e of lock.entries) {
    summary[e.action] = (summary[e.action] || 0) + 1;
    if (e.target) {
      const text = renderMetafile(e.target);
      const abs = path.join(root, e.target.metafile);
      if (!fs.existsSync(abs) || fs.readFileSync(abs, 'utf8') !== text) writes.push({ rel: e.target.metafile, text });
    }
    // defer and drop remove the metafile; replace removes the old one when the target has a new name.
    if (e.action !== 'add' && (!e.target || e.target.metafile !== e.metafile) && fs.existsSync(path.join(root, e.metafile))) deletes.push(e.metafile);
  }
  const packText = fs.readFileSync(path.join(root, 'pack.toml'), 'utf8');
  const nextPack = renderVersions(packText, lock.runtime);
  if (nextPack !== packText) writes.push({ rel: 'pack.toml', text: nextPack });
  const byRel = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  writes.sort((a, b) => byRel(a.rel, b.rel));
  deletes.sort(byRel);
  return { writes, deletes, summary };
}

// Writes temp files first, then renames them over the targets and deletes; on any failure the
// originals are restored from memory, so a partial pack never remains.
function apply(root, changes, { fsImpl = fs } = {}) {
  const originals = new Map();
  const record = (rel) => { const abs = path.join(root, rel); if (!originals.has(rel)) originals.set(rel, fsImpl.existsSync(abs) ? fsImpl.readFileSync(abs) : null); };
  const temps = [];
  try {
    for (const w of changes.writes) {
      const abs = path.join(root, w.rel);
      const tmp = `${abs}.migrate-${process.pid}.tmp`;
      fsImpl.writeFileSync(tmp, w.text);
      temps.push(tmp);
    }
    for (const w of changes.writes) { record(w.rel); fsImpl.renameSync(`${path.join(root, w.rel)}.migrate-${process.pid}.tmp`, path.join(root, w.rel)); temps.shift(); }
    for (const rel of changes.deletes) { record(rel); fsImpl.rmSync(path.join(root, rel), { force: true }); }
  } catch (err) {
    for (const tmp of temps) fsImpl.rmSync(tmp, { force: true });
    for (const [rel, bytes] of originals) {
      const abs = path.join(root, rel);
      if (bytes === null) fsImpl.rmSync(abs, { force: true }); else fsImpl.writeFileSync(abs, bytes);
    }
    throw new Error(`apply failed and was rolled back: ${err.message}`);
  }
}

module.exports = { renderMetafile, renderVersions, plan, planApplied, changeSet, appliedDifferences, apply };
