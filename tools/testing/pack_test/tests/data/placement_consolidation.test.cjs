'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Pro Placer is replaced by the client-only owned mod while its shared library remains', () => {
  assert.equal(fs.existsSync(path.join(root, 'mods/pro-placer.pw.toml')), false);
  assert.ok(fs.existsSync(path.join(root, 'mods/evileye-client.pw.toml')));
  assert.match(read('mods/evileye-client.pw.toml'), /^side = "client"$/m);
  for (const name of ['puzzles-lib', 'diagonal-fences', 'modern-ui', 'quick-skin', '3dskinlayers']) {
    assert.ok(fs.existsSync(path.join(root, 'mods', name + '.pw.toml')), name + ' remains');
  }
  assert.ok(JSON.parse(read('tools/testing/pack_test/data/policy.json')).removedMods.includes('proplacer'));
  const lock = JSON.parse(read('tools/packwiz/migration/target-lock.json'));
  const client = lock.entries.find(e => e.metafile === 'mods/evileye-client.pw.toml').target;
  assert.equal(client.side, 'client');
  const removed = lock.entries.find(e => e.metafile === 'mods/pro-placer.pw.toml');
  assert.equal(removed.action, 'drop');
  assert.equal(removed.target, undefined);
});

test('observed placement settings and unbound owned toggle are carried', () => {
  const config = read('config/evileye_client-client.toml').split('[placement]')[1];
  assert.ok(config);
  for (const setting of ['allowReachAroundPlacement', 'allowFastPlacement']) {
    assert.match(config, new RegExp('\\b' + setting + ' = true'));
  }
  assert.match(config, /bypassUseBlock = false/);
  assert.match(config, /normalPlacementBlocks = \["minecraft:scaffolding"\]/);
  const keys = read('config/defaultoptions/keybindings.txt');
  assert.match(keys, /^key_key.evileye_client.placement.toggle:key.keyboard.unknown$/m);
  assert.doesNotMatch(keys, /^key_key.fast_placement:/m);
});
