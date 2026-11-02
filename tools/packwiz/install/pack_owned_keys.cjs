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
  node[e.key] = e.value;
  return JSON.stringify(doc, null, 4) + '\n';
}

function tomlValue(v) {
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
    if (m) { lines[i] = `${m[1]}${e.key} = ${tomlValue(e.value)}`; return lines.join('\n'); }
  }
  lines.splice(start + 1, 0, `${table ? '\t' : ''}${e.key} = ${tomlValue(e.value)}`);
  return lines.join('\n');
}

const SETTERS = { json: setJson, toml: setToml };

/** Applies every entry under `instance` (a .minecraft folder); returns the files changed. */
function applyOwnedKeys(instance, entries = loadEntries()) {
  const changed = new Set();
  for (const e of entries) {
    if (!SETTERS[e.format]) throw Error('Unknown owned-key format: ' + e.format);
    if (path.isAbsolute(e.file) || e.file.split(/[\/]/).includes('..')) throw Error('Unsafe owned-key path');
    const file = path.join(instance, e.file);
    const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    const after = SETTERS[e.format](before, e);
    if (after !== before) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, after);
      changed.add(e.file);
    }
  }
  return [...changed];
}

module.exports = { loadEntries, applyOwnedKeys, setJson, setToml };
