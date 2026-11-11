'use strict';
// Forces pack-owned keys into Trial's installed configs. packwiz never rewrites
// `preserve = true` files after their first install, so pack fixes to those files
// (and to configs a mod generates itself) would never arrive. Edit
// pack-owned-keys.json; install_pack.cjs applies it after every sync.
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, 'pack-owned-keys.json');
const loadEntries = () => JSON.parse(fs.readFileSync(DATA, 'utf8')).keys;

function setJson(text, e) {
  const doc = text ? JSON.parse(text) : {};
  let node = doc;
  for (const s of e.section) node = (node[s] = node[s] && typeof node[s] === 'object' ? node[s] : {});
  // A mod may rewrite its JSON with its own formatting; an already-correct value must not
  // count as a change, or the dry-run reports (and sync rewrites) it on every launch.
  if (text && JSON.stringify(node[e.key]) === JSON.stringify(e.value)) return text;
  node[e.key] = e.value;
  return JSON.stringify(doc, null, 4) + '\n';
}

function tomlValue(v, type) {
  if (type === 'integer') {
    if (!Number.isSafeInteger(v)) throw Error('Expected a safe TOML integer');
    return String(v);
  }
  return typeof v === 'number' && Number.isInteger(v) ? v.toFixed(1) : JSON.stringify(v);
}

function setToml(text, e) {
  const table = e.section.join('.');
  const lines = text ? text.split('\n') : [];
  const head = `[${table}]`;
  // An empty section means top-level keys, which sit before the first table header.
  let start = table ? lines.findIndex(l => l.trim() === head) : -1;
  if (table && start < 0) {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('');
    lines.push(head); start = lines.length - 1; lines.push('');
  }
  let end = start + 1;
  while (end < lines.length && !/^\s*\[/.test(lines[end])) end++;
  const re = new RegExp('^(\\s*)' + e.key + '\\s*=');
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(re);
    if (m) { lines[i] = `${m[1]}${e.key} = ${tomlValue(e.value, e.tomlType)}`; return lines.join('\n'); }
  }
  lines.splice(start + 1, 0, `${table ? '\t' : ''}${e.key} = ${tomlValue(e.value, e.tomlType)}`);
  return lines.join('\n');
}

// options.txt is `key:value` per line (Minecraft writes CRLF on Windows). Only lines that start with
// exactly `<key>:` are replaced, every occurrence in place, so any saved binding or modifier suffix
// (`key.keyboard.c:SHIFT`) for the key is overwritten. Every other byte, including line endings, is
// kept. An absent or empty file is left alone: a fresh instance gets the key from defaultoptions.
function setOptions(text, e) {
  if (!text) return text;
  const parts = text.split(/(\r?\n)/); // even indexes are lines, odd are their separators
  const want = `${e.key}:${e.value}`;
  let found = false;
  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i].startsWith(e.key + ':')) { parts[i] = want; found = true; }
  }
  if (found) return parts.join('');
  const eol = parts[1] || '\n';
  return parts[parts.length - 1] === '' ? text + want + eol : text + eol + want;
}
setOptions.raw = true; // no CRLF normalisation: unrelated lines stay byte-identical

const SETTERS = { json: setJson, toml: setToml, options: setOptions };

// Walks the entries in order; each sees the text the previous entry left. dryRun keeps that text in
// memory instead of writing. Returns the entries that change something.
function walk(instance, entries, dryRun) {
  const changed = [];
  const pending = new Map();
  for (const e of entries) {
    if (!SETTERS[e.format]) throw Error('Unknown owned-key format: ' + e.format);
    if (path.isAbsolute(e.file) || e.file.split(/[\/]/).includes('..')) throw Error('Unsafe owned-key path');
    const file = path.join(instance, e.file);
    const raw = pending.has(file) ? pending.get(file) : fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const before = SETTERS[e.format].raw ? raw : raw.replace(/\r\n/g, '\n');
    const after = SETTERS[e.format](before, e);
    if (after === before) continue;
    if (dryRun) pending.set(file, after);
    else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, after); }
    changed.push(e);
  }
  return changed;
}

/** Applies every entry under `instance` (a .minecraft folder); returns the files changed. */
const applyOwnedKeys = (instance, entries = loadEntries()) => [...new Set(walk(instance, entries, false).map(e => e.file))];

/** Read-only: the `file key` labels a sync would force right now. */
const previewOwnedKeys = (instance, entries = loadEntries()) => walk(instance, entries, true).map(e => `${e.file} ${e.key}`);

module.exports = { loadEntries, applyOwnedKeys, previewOwnedKeys, setJson, setToml, setOptions };
