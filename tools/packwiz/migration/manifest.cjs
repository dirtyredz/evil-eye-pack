'use strict';
// The target lock's contract: the source-pack fingerprint, deterministic serialization and the
// validation every consumer runs before trusting a lock (complete source coverage, per-action
// fields, hashes, side and update-table consistency). Pure apart from reading source metafiles.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../data_io/files.cjs');

const SCHEMA = 1;
const ACTIONS = new Set(['retain', 'repoint', 'replace', 'defer', 'drop', 'add']);
const SOURCES = new Set(['modrinth', 'curseforge', 'direct']);
const SIDES = new Set(['client', 'server', 'both']);
const FOLDERS = ['mods', 'resourcepacks', 'shaderpacks'];
const HEX = { sha1: 40, sha256: 64, sha512: 128 };

// Every packwiz metafile the lock must account for, repo-relative with forward slashes.
function sourceMetafiles(root) {
  const out = [];
  for (const dir of FOLDERS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).filter(n => n.endsWith('.pw.toml')).sort()) out.push(`${dir}/${f}`);
  }
  return out;
}

// sha256 over the sorted metafile paths and byte hashes plus pack.toml's [versions] table. A lock
// built against one source state refuses to apply to any other.
function fingerprint(root) {
  const lines = sourceMetafiles(root).map(rel => `${rel}\t${sha256(fs.readFileSync(path.join(root, rel)))}`);
  const pack = fs.readFileSync(path.join(root, 'pack.toml'), 'utf8').replace(/\r\n/g, '\n');
  const versions = (/^\[versions\]\n((?:[^[\n].*\n?)*)/m.exec(pack) || [, ''])[1].trim();
  return sha256(`${lines.join('\n')}\nversions:${versions}\n`);
}

// Stable key order and LF line endings, so the same inputs always produce identical bytes.
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]));
  return v;
}
function serialize(lock) {
  const entries = [...lock.entries].sort((a, b) => (a.metafile < b.metafile ? -1 : a.metafile > b.metafile ? 1 : 0));
  return JSON.stringify(sortKeys({ ...lock, entries }), null, 1) + '\n';
}

function checkHash(errors, where, kind, value) {
  if (typeof value !== 'string' || value.length !== HEX[kind] || !/^[0-9a-f]+$/.test(value)) errors.push(`${where}: invalid ${kind}`);
}

// Validate a lock against the source metafile list. Returns sorted error strings ([] = valid).
function validate(lock, sources) {
  const errors = [];
  if (!lock || lock.schema !== SCHEMA) return [`lock schema must be ${SCHEMA}`];
  if (!lock.source?.fingerprint) errors.push('lock has no source fingerprint');
  const rt = lock.runtime || {};
  if (rt.loader !== 'neoforge' || !rt.minecraft || !rt.loaderVersion || !rt.java) errors.push('lock runtime must name minecraft, neoforge loaderVersion and java');
  if (rt.installer) checkHash(errors, 'runtime installer', 'sha256', rt.installer.sha256);
  const seen = new Map();
  const targets = new Map();
  for (const e of lock.entries || []) {
    const where = e.metafile || '(no metafile)';
    if (!ACTIONS.has(e.action)) { errors.push(`${where}: unknown action ${e.action}`); continue; }
    seen.set(e.metafile, (seen.get(e.metafile) || 0) + 1);
    if (!e.rationale) errors.push(`${where}: no rationale`);
    if (e.action === 'add' ? e.old : !e.old) errors.push(`${where}: ${e.action === 'add' ? 'add must not carry' : 'needs'} the old identity`);
    const needsTarget = !['defer', 'drop'].includes(e.action);
    if (needsTarget !== !!e.target) { errors.push(`${where}: ${e.action} ${needsTarget ? 'needs' : 'must not carry'} a target`); continue; }
    if (!e.target) continue;
    const t = e.target;
    if (!t.metafile || !/^(mods|resourcepacks|shaderpacks)\/[^/]+\.pw\.toml$/.test(t.metafile)) errors.push(`${where}: invalid target metafile`);
    if (targets.has(t.metafile)) errors.push(`${where}: target metafile ${t.metafile} also written by ${targets.get(t.metafile)}`);
    targets.set(t.metafile, where);
    if (['repoint', 'retain'].includes(e.action) && t.metafile !== e.metafile) errors.push(`${where}: ${e.action} must keep its metafile`);
    if (!SOURCES.has(t.source)) errors.push(`${where}: unknown target source ${t.source}`);
    if (!SIDES.has(t.side)) errors.push(`${where}: invalid side ${t.side}`);
    if (!t.filename || /[\\/]/.test(t.filename)) errors.push(`${where}: invalid filename`);
    if (!t.name) errors.push(`${where}: no name`);
    checkHash(errors, where, 'sha1', t.sha1);
    checkHash(errors, where, 'sha256', t.sha256);
    if (!(t.size > 0)) errors.push(`${where}: no size`);
    if (t.source === 'modrinth') {
      if (!t.project || !t.version || !/^https:\/\/cdn\.modrinth\.com\//.test(t.url || '')) errors.push(`${where}: modrinth target needs project, version and a CDN url`);
      checkHash(errors, where, 'sha512', t.sha512);
    } else if (t.source === 'curseforge') {
      if (!/^\d+$/.test(String(t.project)) || !/^\d+$/.test(String(t.file))) errors.push(`${where}: curseforge target needs numeric project and file ids`);
      if (t.url) errors.push(`${where}: curseforge metadata mode carries no download url`);
    } else if (t.source === 'direct') {
      if (!/^https:\/\//.test(t.url || '') || t.project || t.version || t.file) errors.push(`${where}: direct target needs an https url and no update table`);
    }
  }
  for (const s of sources) {
    const n = seen.get(s) || 0;
    if (n !== 1) errors.push(`${s}: accounted for ${n} times (exactly once required)`);
  }
  for (const [m, n] of seen) {
    const entry = lock.entries.find(e => e.metafile === m);
    if (entry.action !== 'add' && !sources.includes(m)) errors.push(`${m}: not a source metafile`);
    if (entry.action === 'add' && sources.includes(m)) errors.push(`${m}: add collides with an existing source metafile`);
    if (n > 1 && entry.action === 'add') errors.push(`${m}: added more than once`);
  }
  return [...new Set(errors)].sort();
}

module.exports = { SCHEMA, FOLDERS, sourceMetafiles, fingerprint, serialize, validate };
