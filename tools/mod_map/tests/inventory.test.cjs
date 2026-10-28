'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { zip } = require('../../malware_guard/tests/fixtures.cjs');
const { inspectJar, inventory } = require('../inventory.cjs');
const toml = id => `[[mods]]\nmodId="${id}"\ndisplayName="${id}"\n`;
test('only declared jarjar archives are traversed; multi-mod jars preserve both IDs', () => {
  const bytes = zip([
    ['META-INF/mods.toml', toml('a') + toml('b')],
    ['META-INF/jarjar/metadata.json', JSON.stringify({ jars: [{ path: 'META-INF/jarjar/lib.jar' }] })],
    ['META-INF/jarjar/lib.jar', zip([['META-INF/mods.toml', toml('lib')]])],
    ['META-INF/jarjar/undeclared.jar', 'not even a zip']
  ]);
  const entries = []; inspectJar(bytes, 'a.jar', e => entries.push(e));
  assert.deepEqual(entries[0].mods.map(m => m.id), ['a', 'b']);
  assert.equal(entries[1].mods[0].id, 'lib'); assert.equal(entries[1].bundled, true);
  assert.throws(() => inspectJar(zip([['META-INF/jarjar/metadata.json', '{"jars":[{"path":"missing.jar"}]}']]), 'x', () => {}), /Missing declared/);
});
test('inventory accepts only pinned bytes, falls back to cache, and coalesces embedded/external IDs', t => {
  const base = path.resolve(__dirname, '../../../.tmp/tests'); fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'mod-map-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['mods', 'installed', 'cache']) fs.mkdirSync(path.join(root, dir));
  const lib = zip([['META-INF/mods.toml', toml('lib')]]);
  const host = zip([['META-INF/mods.toml', toml('host')], ['META-INF/jarjar/metadata.json', '{"jars":[{"path":"META-INF/jarjar/lib.jar"}]}'], ['META-INF/jarjar/lib.jar', lib]]);
  for (const [name, bytes] of [['host', host], ['lib', lib]]) {
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    fs.writeFileSync(path.join(root, 'mods', name + '.pw.toml'), `name = "${name}"\nfilename = "${name}.jar"\nside = "both"\n[download]\nhash-format = "sha256"\nhash = "${hash}"\n`);
    fs.writeFileSync(path.join(root, 'cache', name + '.jar'), bytes);
    fs.writeFileSync(path.join(root, 'installed', name + '.jar'), 'stale');
  }
  const input = inventory(root, [path.join(root, 'installed'), path.join(root, 'cache')]);
  assert.equal(input.nodes.length, 2);
  assert.deepEqual(input.nodes.find(n => n.key === 'host.jar').dependencies, ['lib.jar']);
  assert.match(input.warnings[0], /represented once/);
  assert.throws(() => inventory(root, [path.join(root, 'installed')]), /Missing pinned jar/);
});
test('wrapper jar with only embedded Forge metadata remains the physical dependency unit', t => {
  const base = path.resolve(__dirname, '../../../.tmp/tests'); fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'mod-map-wrapper-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ['mods', 'cache']) fs.mkdirSync(path.join(root, dir));
  const nested = zip([['META-INF/mods.toml', toml('language_loader')]]);
  const wrapper = zip([
    ['META-INF/jarjar/metadata.json', '{"jars":[{"path":"META-INF/jarjar/loader.jar"}]}'],
    ['META-INF/jarjar/loader.jar', nested]
  ]);
  const hash = crypto.createHash('sha256').update(wrapper).digest('hex');
  fs.writeFileSync(path.join(root, 'mods/loader.pw.toml'), `name = "Loader"\nfilename = "loader.jar"\n[download]\nhash-format = "sha256"\nhash = "${hash}"\n`);
  fs.writeFileSync(path.join(root, 'cache/loader.jar'), wrapper);
  const input = inventory(root, [path.join(root, 'cache')]);
  assert.equal(input.nodes.length, 1);
  assert.equal(input.nodes[0].key, 'loader.jar');
  assert.deepEqual(input.nodes[0].mods.map(m => m.id), ['language_loader']);
});
