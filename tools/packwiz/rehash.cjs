#!/usr/bin/env node
'use strict';
// Rebuilds index.toml membership and hashes, then pack.toml's index hash: the
// subset of `packwiz refresh` this pack needs (the packwiz CLI is not installed).
//
//   node tools/packwiz/rehash.cjs [--root <dir>] [--dry-run]
//
// - Publishable files (git-visible, not excluded by .packwizignore) are indexed;
//   `mods/*.pw.toml` and `shaderpacks/*.pw.toml` are marked `metafile = true`.
// - Entries for deleted or newly ignored files are dropped.
// - Hashes are sha256 of the files' actual bytes. A text file with CR or a BOM is
//   refused rather than normalized: fix the file (save as UTF-8 LF) and run again.

const fs = require('node:fs');
const path = require('node:path');
const P = require('./pack_index.cjs');

function isMetafile(rel) {
  return /^(mods|shaderpacks|resourcepacks)\/[^/]+\.pw\.toml$/.test(rel);
}

function rehash(root, opts) {
  const options = opts || {};
  const ignore = P.loadIgnore(root);
  const problems = [];
  const files = P.listRepoFiles(root).filter((rel) => !P.isIgnored(ignore, rel)).sort(P.comparePaths);
  const entries = [];
  for (const rel of files) {
    const bytes = fs.readFileSync(path.join(root, rel));
    problems.push(...P.textProblems(rel, bytes));
    entries.push({ file: rel, hash: P.sha256(bytes), metafile: isMetafile(rel), hashFormat: null });
  }
  if (problems.length) return { problems, written: false };

  const indexPath = path.join(root, 'index.toml');
  const before = P.parseIndex(fs.readFileSync(indexPath, 'utf8'));
  const oldByFile = new Map(before.files.map((f) => [f.file, f]));
  const added = entries.filter((e) => !oldByFile.has(e.file)).map((e) => e.file);
  const keep = new Set(entries.map((e) => e.file));
  const removed = before.files.filter((f) => !keep.has(f.file)).map((f) => f.file);
  const changed = entries.filter((e) => oldByFile.has(e.file) && oldByFile.get(e.file).hash !== e.hash).map((e) => e.file);

  const indexText = P.formatIndex({ hashFormat: 'sha256', files: entries });
  const packPath = path.join(root, 'pack.toml');
  const packText = P.setPackIndexHash(fs.readFileSync(packPath, 'utf8'), P.sha256(Buffer.from(indexText, 'utf8')));
  if (!options.dryRun) {
    fs.writeFileSync(indexPath, indexText);
    fs.writeFileSync(packPath, packText);
  }
  return { problems, written: !options.dryRun, added, removed, changed, entries: entries.length };
}

function main(argv) {
  const i = argv.indexOf('--root');
  const root = path.resolve(i === -1 ? path.join(__dirname, '..', '..') : argv[i + 1]);
  const r = rehash(root, { dryRun: argv.includes('--dry-run') });
  if (r.problems.length) {
    for (const p of r.problems) console.error('REFUSED ' + p);
    return 1;
  }
  for (const f of r.added) console.log('+ ' + f);
  for (const f of r.removed) console.log('- ' + f);
  for (const f of r.changed) console.log('~ ' + f);
  console.log((r.written ? 'wrote' : 'dry run:') + ' ' + r.entries + ' entries (+' + r.added.length + ' -' +
    r.removed.length + ' ~' + r.changed.length + ')');
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { rehash, isMetafile };
