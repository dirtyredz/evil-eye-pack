#!/usr/bin/env node
'use strict';
// Read-only verification of the packwiz hash chain (no packwiz CLI needed).
//
//   node tools/packwiz/verify_hashes.cjs [--root <dir>] [--jars <dir>]
//
// Checks, over the files' actual bytes (no CRLF normalization):
//   - pack.toml's [index] hash equals sha256(index.toml);
//   - every index entry exists, is listed once, and its sha256 matches;
//   - no indexed path is excluded by .packwizignore (tooling, fixtures, docs);
//   - every publishable file that is not ignored is indexed;
//   - indexed text files carry no BOM and no CR;
//   - every metafile has a concrete [download] hash, hash-format and source;
//   - with --jars: each jar named by a metafile's `filename` hashes to its download hash.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const P = require('./pack_index.cjs');

const HASH_LENGTHS = { sha1: 40, sha256: 64, sha512: 128, md5: 32 };

function verify(root, opts) {
  const options = opts || {};
  const problems = [];
  const read = (rel) => fs.readFileSync(path.join(root, rel));

  const packText = read('pack.toml').toString('utf8');
  const ref = P.readPackIndexRef(packText);
  if (ref.hashFormat !== 'sha256') problems.push('pack.toml: [index] hash-format must be sha256');
  const indexBytes = read(ref.file || 'index.toml');
  const indexHash = P.sha256(indexBytes);
  if (indexHash !== ref.hash) problems.push('pack.toml: index hash ' + ref.hash + ' != sha256(index.toml) ' + indexHash);
  problems.push(...P.textProblems('index.toml', indexBytes), ...P.textProblems('pack.toml', Buffer.from(packText)));

  const index = P.parseIndex(indexBytes.toString('utf8'));
  if (index.hashFormat !== 'sha256') problems.push('index.toml: hash-format must be sha256');
  const ignore = P.loadIgnore(root);
  const seen = new Set();
  const metafiles = [];
  for (const entry of index.files) {
    if (!entry.file || !entry.hash) { problems.push('index.toml: entry missing file or hash'); continue; }
    if (seen.has(entry.file)) problems.push('index.toml: duplicate entry ' + entry.file);
    seen.add(entry.file);
    if (P.isIgnored(ignore, entry.file)) problems.push(entry.file + ': indexed but excluded by .packwizignore');
    const abs = path.join(root, entry.file);
    if (!fs.existsSync(abs)) { problems.push(entry.file + ': indexed but missing'); continue; }
    const bytes = fs.readFileSync(abs);
    const actual = P.sha256(bytes);
    if (actual !== entry.hash) problems.push(entry.file + ': hash ' + entry.hash + ' != actual ' + actual);
    problems.push(...P.textProblems(entry.file, bytes));
    if (entry.metafile) metafiles.push({ file: entry.file, text: bytes.toString('utf8') });
  }

  let publishable = 0;
  for (const rel of P.publishableFiles(root)) {
    publishable++;
    if (!seen.has(rel)) problems.push(rel + ': not ignored but not indexed');
  }

  const downloads = [];
  for (const m of metafiles) {
    const d = P.readMetafileDownload(m.text);
    const want = HASH_LENGTHS[d.hashFormat];
    if (!want) problems.push(m.file + ': unknown or missing [download] hash-format');
    else if (!d.hash || !new RegExp('^[0-9a-f]{' + want + '}$').test(d.hash)) problems.push(m.file + ': [download] hash is not a concrete ' + d.hashFormat);
    if (!d.url && d.mode !== 'metadata:curseforge') problems.push(m.file + ': [download] has neither url nor metadata:curseforge mode');
    if (!d.filename) problems.push(m.file + ': missing filename');
    downloads.push({ file: m.file, ...d });
  }

  let jarsChecked = 0;
  if (options.jars) {
    const byName = new Map(downloads.map((d) => [d.filename, d]));
    for (const name of fs.readdirSync(options.jars)) {
      const d = byName.get(name);
      if (!d) continue;
      jarsChecked++;
      const h = crypto.createHash(d.hashFormat).update(fs.readFileSync(path.join(options.jars, name))).digest('hex');
      if (h !== d.hash) problems.push(name + ': ' + d.hashFormat + ' ' + h + ' != ' + d.file + ' ' + d.hash);
    }
  }

  return { problems, entries: index.files.length, metafiles: metafiles.length, publishable, jarsChecked, indexHash };
}

function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
  const root = path.resolve(arg('--root') || path.join(__dirname, '..', '..'));
  const r = verify(root, { jars: arg('--jars') });
  for (const p of r.problems) console.error('MISMATCH ' + p);
  console.log((r.problems.length ? 'FAIL' : 'OK') + ' ' + r.problems.length + ' mismatches; ' + r.entries +
    ' index entries (' + r.metafiles + ' metafiles), ' + r.publishable + ' publishable files, index sha256 ' +
    r.indexHash + (arg('--jars') ? ', ' + r.jarsChecked + ' jars checked against metafiles' : ''));
  return r.problems.length ? 1 : 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { verify };
