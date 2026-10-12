'use strict';
// Shared packwiz index model (no packwiz CLI needed): parse/format index.toml and the
// pack.toml index hash, apply .packwizignore, and hash files over their ACTUAL bytes.
// Nothing here normalizes line endings; CR or BOM in a text file is reported instead,
// because GitHub serves the LF bytes git stores (core.autocrlf=input).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// packwiz never indexes these (its built-in ignore list plus its own files).
const BUILTIN_IGNORES = [
  '.git/**', '.gitattributes', '.gitignore', '.gitmodules', '.mailmap', '.DS_Store',
  'desktop.ini', 'thumbs.db', '.packwizignore', 'pack.toml', 'index.toml',
];
const TEXT_EXTENSIONS = new Set([
  '.toml', '.json', '.json5', '.js', '.cfg', '.txt', '.properties', '.snbt', '.md', '.css',
  '.yml', '.yaml', '.ini', '.conf', '.mcmeta', '.csv', '.lang', '.zs', '.xml',
]);

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isTextPath(p) {
  return TEXT_EXTENSIONS.has(path.extname(p).toLowerCase());
}

/** Problems with how a text file's bytes would be served (CRLF, BOM). */
function textProblems(rel, buf) {
  const out = [];
  if (!isTextPath(rel)) return out;
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) out.push(rel + ': starts with a UTF-8 BOM');
  if (buf.includes(13)) out.push(rel + ': contains CR (CRLF) line endings; git/GitHub serve LF bytes');
  return out;
}

// ---- .packwizignore (gitignore subset: *, **, ?, trailing /, leading /, !negation) ----

function globToRegExp(pattern) {
  let p = pattern;
  const anchored = p.startsWith('/') || p.slice(0, -1).includes('/');
  if (p.startsWith('/')) p = p.slice(1);
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  let re = '';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '*') {
      if (p[i + 1] === '*') {
        i++;
        if (p[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  const prefix = anchored ? '^' : '^(?:.*/)?';
  // A match on a directory also covers everything below it.
  return new RegExp(prefix + re + (dirOnly ? '/.*$' : '(?:/.*)?$'));
}

function parseIgnore(text) {
  const rules = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    rules.push({ negate, re: globToRegExp(negate ? line.slice(1) : line), source: line });
  }
  return rules;
}

function loadIgnore(root) {
  const file = path.join(root, '.packwizignore');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return parseIgnore(BUILTIN_IGNORES.join('\n') + '\n' + text);
}

function isIgnored(rules, rel) {
  let ignored = false;
  for (const r of rules) if (r.re.test(rel)) ignored = !r.negate;
  return ignored;
}

// ---- index.toml / pack.toml ----

function unquote(s, where) {
  if (!/^"(?:[^"\\]|\\.)*"$/.test(s)) throw new Error(where + ': expected a TOML basic string, got ' + s);
  return JSON.parse(s);
}

/** Strict parser for the index.toml shape packwiz writes. */
function parseIndex(text) {
  const lines = text.split('\n');
  const index = { hashFormat: null, files: [] };
  let cur = null;
  lines.forEach((line, n) => {
    const where = 'index.toml:' + (n + 1);
    if (line === '') return;
    if (line === '[[files]]') { cur = { file: null, hash: null, metafile: false, hashFormat: null }; index.files.push(cur); return; }
    const m = /^([a-z-]+) = (.*)$/.exec(line);
    if (!m) throw new Error(where + ': unrecognized line ' + JSON.stringify(line));
    const [, key, value] = m;
    if (cur === null) {
      if (key !== 'hash-format') throw new Error(where + ': unexpected top-level key ' + key);
      index.hashFormat = unquote(value, where);
    } else if (key === 'file') cur.file = unquote(value, where);
    else if (key === 'hash') cur.hash = unquote(value, where);
    else if (key === 'hash-format') cur.hashFormat = unquote(value, where);
    else if (key === 'metafile') {
      if (value !== 'true' && value !== 'false') throw new Error(where + ': metafile must be a boolean');
      cur.metafile = value === 'true';
    } else throw new Error(where + ': unexpected key ' + key);
  });
  return index;
}

function formatIndex(index) {
  let out = 'hash-format = ' + JSON.stringify(index.hashFormat) + '\n';
  for (const f of index.files) {
    out += '\n[[files]]\nfile = ' + JSON.stringify(f.file) + '\n';
    if (f.hashFormat) out += 'hash-format = ' + JSON.stringify(f.hashFormat) + '\n';
    out += 'hash = ' + JSON.stringify(f.hash) + '\n';
    if (f.metafile) out += 'metafile = true\n';
  }
  return out;
}

// Lines of pack.toml's [index] table: [start, end) line numbers.
function indexTableRange(lines) {
  const start = lines.indexOf('[index]');
  if (start === -1) throw new Error('pack.toml has no [index] table');
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('[')) end++;
  return [start + 1, end];
}

function readPackIndexRef(packText) {
  const lines = packText.split('\n');
  const [start, end] = indexTableRange(lines);
  const ref = { file: null, hashFormat: null, hash: null };
  for (let i = start; i < end; i++) {
    const m = /^(file|hash-format|hash) = "([^"]*)"$/.exec(lines[i]);
    if (m) ref[m[1] === 'hash-format' ? 'hashFormat' : m[1]] = m[2];
  }
  return ref;
}

function setPackIndexHash(packText, hash) {
  const lines = packText.split('\n');
  const [start, end] = indexTableRange(lines);
  for (let i = start; i < end; i++) {
    if (/^hash = "[^"]*"$/.test(lines[i])) {
      lines[i] = 'hash = "' + hash + '"';
      return lines.join('\n');
    }
  }
  throw new Error('pack.toml [index] table has no hash');
}

/** Reads the [download] table of a packwiz metafile (.pw.toml). */
function readMetafileDownload(text) {
  const lines = text.split('\n');
  const start = lines.indexOf('[download]');
  const out = { filename: null, url: null, hashFormat: null, hash: null, mode: null };
  const fm = /^filename = "([^"]*)"$/m.exec(text);
  if (fm) out.filename = fm[1];
  if (start === -1) return out;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('['); i++) {
    const m = /^(url|hash-format|hash|mode) = "([^"]*)"$/.exec(lines[i]);
    if (m) out[m[1] === 'hash-format' ? 'hashFormat' : m[1]] = m[2];
  }
  return out;
}

/** Files git would publish: tracked plus untracked-but-not-gitignored. */
function listRepoFiles(root) {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root });
  return out.toString('utf8').split('\0').filter((p) => p !== '' && fs.existsSync(path.join(root, p)));
}

/** Publishable files: git-visible, not excluded by .packwizignore, in index (byte) order. */
function publishableFiles(root) {
  const ignore = loadIgnore(root);
  return listRepoFiles(root).filter((rel) => !isIgnored(ignore, rel)).sort(comparePaths);
}

/** Byte-order path sort, matching the existing index.toml ordering. */
function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

module.exports = {
  BUILTIN_IGNORES, sha256, isTextPath, textProblems, globToRegExp, parseIgnore, loadIgnore, isIgnored,
  parseIndex, formatIndex, readPackIndexRef, setPackIndexHash, readMetafileDownload, listRepoFiles, publishableFiles, comparePaths,
};
