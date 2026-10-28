'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inventory, prepare } = require('../offline_server.cjs');

test('offline inventory verifies server pins and never needs client-only jars', t => {
  const root = fs.mkdtempSync(path.join(__dirname, 'offline-server-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cache = path.join(root, 'cache'); fs.mkdirSync(path.join(root, 'mods')); fs.mkdirSync(path.join(cache, 'mods'), { recursive: true });
  const bytes = Buffer.from('fixture'), hash = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(root, 'index.toml'), 'hash-format = "sha256"\n' + ['server', 'client'].map(n => '\n[[files]]\nfile = "mods/' + n + '.pw.toml"\nhash = "unused"\nmetafile = true\n').join(''));
  for (const n of ['server', 'client']) fs.writeFileSync(path.join(root, 'mods', n + '.pw.toml'), 'name = "fixture"\nfilename = "' + n + '.jar"\nside = "' + (n === 'client' ? 'client' : 'both') + '"\n[download]\nhash-format = "sha256"\nhash = "' + hash + '"\nurl = "https://invalid.test/never-downloaded"\n');
  assert.throws(() => inventory(root, cache), /Missing pinned jar/);
  fs.writeFileSync(path.join(cache, 'mods/server.jar'), bytes);
  assert.equal(inventory(root, cache).length, 1);
  fs.writeFileSync(path.join(cache, 'mods/server.jar'), 'wrong');
  assert.throws(() => inventory(root, cache), /differs from pin/);
});

test('prepare writes the flat showcase world by default and the ordinary world on request', t => {
  const root = fs.mkdtempSync(path.join(__dirname, 'offline-server-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cache = path.join(root, 'cache'); fs.mkdirSync(path.join(cache, 'libraries'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.toml'), 'hash-format = "sha256"\n\n[[files]]\nfile = "config/a.toml"\nhash = "unused"\n');
  fs.mkdirSync(path.join(root, 'config')); fs.writeFileSync(path.join(root, 'config/a.toml'), 'a = 1\n');
  const options = { seed: '1', port: 25000, heap: '1G' };
  const properties = name => fs.readFileSync(path.join(root, name, 'server.properties'), 'utf8');
  prepare(root, cache, path.join(root, 'showcase'), options);
  prepare(root, cache, path.join(root, 'ordinary'), { ...options, profile: 'ordinary' });
  assert.match(properties('showcase'), /^level-type=minecraft:flat$/m);
  assert.match(properties('showcase'), /^spawn-monsters=false$/m);
  assert.doesNotMatch(properties('ordinary'), /level-type|generate-structures|spawn-(monsters|animals|npcs)/);
  assert.match(properties('ordinary'), /^level-seed=1$/m);
  assert.ok(fs.existsSync(path.join(root, 'ordinary/config/a.toml')));
  assert.throws(() => prepare(root, cache, path.join(root, 'bad'), { ...options, profile: 'nether' }), /Unknown server profile/);
});
