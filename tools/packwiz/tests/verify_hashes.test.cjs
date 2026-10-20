'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { verify } = require('../verify_hashes.cjs');
const { rehash } = require('../rehash.cjs');
const P = require('../pack_index.cjs');

const JAR = Buffer.from('not really a jar');
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');

// A minimal pack repo: one config, one script, one metafile, tooling that must stay unindexed.
function makePack() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-'));
  const w = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  };
  w('pack.toml', 'name = "T"\npack-format = "packwiz:1.1.0"\n\n[index]\nfile = "index.toml"\nhash-format = "sha256"\nhash = "0"\n\n[versions]\nminecraft = "1.20.1"\n');
  w('index.toml', 'hash-format = "sha256"\n');
  w('.packwizignore', 'tools/\ndocs/\n');
  w('config/a.json', '{\n  "a": 1\n}\n');
  w('kubejs/client_scripts/x.js', '// x\n');
  w('mods/thing.pw.toml', 'name = "Thing"\nfilename = "thing.jar"\nside = "both"\n\n[download]\nhash-format = "sha1"\nhash = "' + sha1(JAR) + '"\nmode = "metadata:curseforge"\n\n[update]\n[update.curseforge]\nfile-id = 1\nproject-id = 2\n');
  w('tools/check.cjs', '// tooling\n');
  w('docs/notes.md', '# notes\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  const r = rehash(root);
  assert.deepEqual(r.problems, []);
  return { root, w, edit: (rel, fn) => w(rel, fn(fs.readFileSync(path.join(root, rel), 'utf8'))) };
}

const problems = (root, opts) => verify(root, opts).problems;

test('a freshly rehashed pack verifies clean and leaves tooling/docs unindexed', () => {
  const { root } = makePack();
  const r = verify(root);
  assert.deepEqual(r.problems, []);
  const files = P.parseIndex(fs.readFileSync(path.join(root, 'index.toml'), 'utf8')).files.map((f) => f.file);
  assert.deepEqual(files, ['config/a.json', 'kubejs/client_scripts/x.js', 'mods/thing.pw.toml']);
  assert.equal(P.parseIndex(fs.readFileSync(path.join(root, 'index.toml'), 'utf8')).files[2].metafile, true);
});

test('CRLF in an indexed text file is detected (not normalized away) and rehash refuses it', () => {
  const { root, w } = makePack();
  w('config/a.json', '{\r\n  "a": 1\r\n}\r\n');
  const p = problems(root);
  assert.ok(p.some((x) => x.includes('config/a.json: contains CR')));
  assert.ok(p.some((x) => x.startsWith('config/a.json: hash')));
  assert.ok(rehash(root).problems.some((x) => x.includes('contains CR')));
});

test('a BOM is detected', () => {
  const { root, w } = makePack();
  w('kubejs/client_scripts/x.js', '﻿// x\n');
  assert.ok(problems(root).some((x) => x.includes('BOM')));
});

test('an altered metafile is detected', () => {
  const { root, edit } = makePack();
  edit('mods/thing.pw.toml', (t) => t.replace('side = "both"', 'side = "client"'));
  assert.ok(problems(root).some((x) => x.startsWith('mods/thing.pw.toml: hash')));
});

test('a placeholder download hash is detected', () => {
  const { root, edit } = makePack();
  edit('mods/thing.pw.toml', (t) => t.replace(/hash = "[0-9a-f]{40}"/, 'hash = "TODO"'));
  rehash(root);
  assert.ok(problems(root).some((x) => x.includes('not a concrete sha1')));
});

test('isMetafile matches only top-level .pw.toml files under mods, shaderpacks, resourcepacks', () => {
  assert.equal(P.isMetafile('mods/a.pw.toml'), true);
  assert.equal(P.isMetafile('shaderpacks/a.pw.toml'), true);
  assert.equal(P.isMetafile('resourcepacks/a.pw.toml'), true);
  assert.equal(P.isMetafile('mods/sub/a.pw.toml'), false);
  assert.equal(P.isMetafile('config/a.pw.toml'), false);
  assert.equal(P.isMetafile('mods/a.toml'), false);
});


test('a wrong index metafile flag is detected in both directions', () => {
  const { root } = makePack();
  const indexPath = path.join(root, 'index.toml');
  const packPath = path.join(root, 'pack.toml');
  const flip = (file) => {
    const index = P.parseIndex(fs.readFileSync(indexPath, 'utf8'));
    const entry = index.files.find((f) => f.file === file);
    entry.metafile = !entry.metafile;
    fs.writeFileSync(indexPath, P.formatIndex(index));
    fs.writeFileSync(packPath, P.setPackIndexHash(fs.readFileSync(packPath, 'utf8'), P.sha256(fs.readFileSync(indexPath))));
  };
  flip('mods/thing.pw.toml');
  assert.ok(problems(root).some((x) => x.startsWith('mods/thing.pw.toml: index metafile flag is false')));
  flip('mods/thing.pw.toml');
  flip('config/a.json');
  assert.ok(problems(root).some((x) => x.startsWith('config/a.json: index metafile flag is true')));
});

test('a stale pack.toml index hash is detected', () => {
  const { root, edit } = makePack();
  edit('index.toml', (t) => t + '\n');
  assert.ok(problems(root).some((x) => x.startsWith('pack.toml: index hash')));
});

test('a missing indexed file is detected', () => {
  const { root } = makePack();
  fs.rmSync(path.join(root, 'config/a.json'));
  assert.ok(problems(root).some((x) => x === 'config/a.json: indexed but missing'));
});

test('a duplicate index path is detected', () => {
  const { root, edit } = makePack();
  edit('index.toml', (t) => t + '\n[[files]]\nfile = "config/a.json"\nhash = "' + P.sha256(Buffer.from('{\n  "a": 1\n}\n')) + '"\n');
  edit('pack.toml', (t) => P.setPackIndexHash(t, P.sha256(fs.readFileSync(path.join(root, 'index.toml')))));
  assert.ok(problems(root).some((x) => x === 'index.toml: duplicate entry config/a.json'));
});

test('indexed tooling or fixtures are detected', () => {
  const { root, edit } = makePack();
  edit('index.toml', (t) => t + '\n[[files]]\nfile = "tools/check.cjs"\nhash = "' + P.sha256(Buffer.from('// tooling\n')) + '"\n');
  edit('pack.toml', (t) => P.setPackIndexHash(t, P.sha256(fs.readFileSync(path.join(root, 'index.toml')))));
  assert.ok(problems(root).some((x) => x === 'tools/check.cjs: indexed but excluded by .packwizignore'));
});

test('a publishable file missing from the index is detected', () => {
  const { root, w } = makePack();
  w('config/new.toml', 'x = 1\n');
  assert.ok(problems(root).some((x) => x === 'config/new.toml: not ignored but not indexed'));
});

test('--jars checks downloaded jar bytes against metafile hashes', () => {
  const { root } = makePack();
  const jars = fs.mkdtempSync(path.join(os.tmpdir(), 'jars-'));
  fs.writeFileSync(path.join(jars, 'thing.jar'), JAR);
  const ok = verify(root, { jars });
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.jarsChecked, 1);
  fs.writeFileSync(path.join(jars, 'thing.jar'), Buffer.concat([JAR, Buffer.from('x')]));
  assert.ok(problems(root, { jars }).some((x) => x.startsWith('thing.jar: sha1')));
});

test('.packwizignore patterns behave like gitignore for directories and globs', () => {
  const rules = P.parseIgnore('tools/\n*.md\n!README.md\n/STRUCTURE.md\n');
  assert.equal(P.isIgnored(rules, 'tools/a/b.cjs'), true);
  assert.equal(P.isIgnored(rules, 'config/tools.json'), false);
  assert.equal(P.isIgnored(rules, 'docs/x.md'), true);
  assert.equal(P.isIgnored(rules, 'README.md'), false);
  assert.equal(P.isIgnored(rules, 'STRUCTURE.md'), true);
});
