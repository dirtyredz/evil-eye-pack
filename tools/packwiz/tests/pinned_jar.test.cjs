'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolvePinnedJar } = require('../pinned_jar.cjs');
const { readMetafileSide } = require('../pack_index.cjs');

const BYTES = Buffer.from('pinned bytes');
const metafile = (filename, side = 'both') => `name = "x"\nfilename = "${filename}"\nside = "${side}"\n\n[download]\nhash-format = "sha256"\nhash = "${crypto.createHash('sha256').update(BYTES).digest('hex')}"\n`;

test('resolves the first folder whose bytes match the pin, skipping stale copies', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pinned-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const d of ['stale', 'good']) fs.mkdirSync(path.join(root, d));
  fs.writeFileSync(path.join(root, 'stale/a.jar'), 'stale');
  fs.writeFileSync(path.join(root, 'good/a.jar'), BYTES);
  const jar = resolvePinnedJar(metafile('a.jar'), [path.join(root, 'missing'), path.join(root, 'stale'), path.join(root, 'good')]);
  assert.equal(jar.path, path.join(root, 'good/a.jar'));
  assert.equal(jar.hashFormat, 'sha256');
  assert.deepEqual(jar.bytes, BYTES);
});

test('fails closed on unsafe names, missing jars and mismatched bytes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pinned-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => resolvePinnedJar(metafile('../a.jar'), [root], 'mods/a.pw.toml'), /Invalid filename in mods\/a\.pw\.toml/);
  assert.throws(() => resolvePinnedJar(metafile('a.jar'), [root]), /Missing pinned jar \(no download attempted\)/);
  fs.writeFileSync(path.join(root, 'a.jar'), 'wrong');
  assert.throws(() => resolvePinnedJar(metafile('a.jar'), [root]), /differs from pin/);
});

test('metafile side defaults to both', () => {
  assert.equal(readMetafileSide(metafile('a.jar', 'client')), 'client');
  assert.equal(readMetafileSide('name = "x"\n[download]\nside = "client"\n'), 'both');
});
