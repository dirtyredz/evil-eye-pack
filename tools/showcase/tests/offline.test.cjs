'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inventory, prepare } = require('../offline.cjs');
const { sections, logGroups } = require('../check.cjs');

test('every shipped section has a committed headless check', () => {
  assert.ok(sections(path.resolve(__dirname, '../../..')).includes('contraption_storage'));
});
test('offline inventory verifies server pins and never needs client-only jars', t => {
  const root = fs.mkdtempSync(path.join(__dirname, 'showcase-test-'));
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
test('warning/error comparison ignores timestamps but retains new script failures', () => {
  const a = logGroups('[12:00:00] [main/WARN] known\n[12:00:01] [main/INFO] harmless');
  const b = logGroups('[13:00:00] [main/WARN] known\n[13:00:01] [Server thread/ERROR] showcase/command.js: failed');
  assert.equal(Object.keys(a).length, 1);
  assert.equal(Object.keys(b).filter(k => !a[k]).length, 1);
});

test('log comparison removes only run locations and Java object identities, retaining resource names', () => {
  const a = '[12:00:00] [main/WARN] Configuration C:/runs/baseline/server/config/example.toml wrong\n[12:00:00] [main/ERROR] parent=DisplayInfo@1a2b';
  const b = '[13:00:00] [main/WARN] Configuration C:/runs/check/server/config/example.toml wrong\n[13:00:00] [main/ERROR] parent=DisplayInfo@feed34';
  assert.deepEqual(logGroups(a, 'C:/runs/baseline/server'), logGroups(b, 'C:/runs/check/server'));
  assert.notDeepEqual(logGroups(a, 'C:/runs/baseline/server'), logGroups(b.replace('example.toml', 'different.toml'), 'C:/runs/check/server'));
});

test('prepare writes the flat showcase world by default and the ordinary world on request', t => {
  const root = fs.mkdtempSync(path.join(__dirname, 'showcase-test-'));
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
