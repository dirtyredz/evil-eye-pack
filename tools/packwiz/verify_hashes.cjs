#!/usr/bin/env node
'use strict';
const { sha256 } = require('../data_io/files.cjs');
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
//   - each entry's `metafile` flag agrees with the path (P.isMetafile);
//   - each entry's `preserve` flag agrees with the owner/game-owned path policy;
//   - every metafile has a concrete [download] hash, hash-format and source;
//   - with --jars: each jar named by a metafile's `filename` hashes to its download hash.
//   - unless --no-stable-cache (or --jars): every pinned jar is in the Stable jar cache (install/stable_cache_check.cjs), when that cache exists
//   - server jars/pins match the last ANU Deploy receipt (explicit skip when ANU/receipt is unavailable).

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
  const indexHash = sha256(indexBytes);
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
    const actual = sha256(bytes);
    if (actual !== entry.hash) problems.push(entry.file + ': hash ' + entry.hash + ' != actual ' + actual);
    problems.push(...P.textProblems(entry.file, bytes));
    if (entry.metafile !== P.isMetafile(entry.file)) {
      problems.push(entry.file + ': index metafile flag is ' + entry.metafile + ' but the path ' + (P.isMetafile(entry.file) ? 'is' : 'is not') + ' a metafile');
    }
    if (entry.preserve !== P.isPreservePath(entry.file)) {
      problems.push(entry.file + ': index preserve flag is ' + entry.preserve + ' but policy expects ' + P.isPreservePath(entry.file));
    }
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
    if (d.mode === 'metadata:local') {
      try { require('./install/local_source.cjs').localPin(root, m.file, m.text); } catch (e) { problems.push(e.message); }
    } else if (!d.url && d.mode !== 'metadata:curseforge') problems.push(m.file + ': [download] has neither url nor metadata:curseforge mode');
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
      const bytes = fs.readFileSync(path.join(options.jars, name));
      const h = d.hashFormat === 'sha256' ? sha256(bytes) : crypto.createHash(d.hashFormat).update(bytes).digest('hex');
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
  const cacheStatus = stableCacheStatus(root, argv);
  const parityStatus = require('../world_server/check-parity.cjs').reportParity(root);
  console.log((r.problems.length ? 'FAIL' : 'OK') + ' ' + r.problems.length + ' mismatches; ' + r.entries +
    ' index entries (' + r.metafiles + ' metafiles), ' + r.publishable + ' publishable files, index sha256 ' +
    r.indexHash + (arg('--jars') ? ', ' + r.jarsChecked + ' jars checked against metafiles' : ''));
  return r.problems.length || cacheStatus || parityStatus ? 1 : 0;
}

// Stable's prelaunch needs every pinned jar in its cache. Checked by default when that cache exists on this
// machine (so the rehash -> verify step before a push catches an unstocked mod add); --no-stable-cache skips.
function stableCacheStatus(root, argv) {
  if (argv.includes('--no-stable-cache') || argv.includes('--jars')) return 0;
  const S = require('./install/stable_cache_check.cjs');
  if (!fs.existsSync(S.DEFAULT_CACHE)) { console.log('SKIP stable jar cache check: ' + S.DEFAULT_CACHE + ' not found on this machine'); return 0; }
  return S.report(S.checkCache(root, S.DEFAULT_CACHE), S.DEFAULT_CACHE);
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { verify };
