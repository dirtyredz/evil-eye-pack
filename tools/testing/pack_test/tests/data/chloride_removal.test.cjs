'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
test('Modern UI supplies enabled Z zoom after Chloride retirement', () => {
  assert.equal(fs.existsSync(path.join(root, 'mods/chloride.pw.toml')), false);
  assert.equal(fs.existsSync(path.join(root, 'config/chloride-client.toml')), false);
  for (const mod of ['modern-ui', 'quick-skin', '3dskinlayers', 'sodium']) {
    assert.ok(fs.existsSync(path.join(root, `mods/${mod}.pw.toml`)), mod);
  }
  const keys = read('config/defaultoptions/keybindings.txt');
  assert.doesNotMatch(keys, /chloride/);
  assert.match(keys, /^key_key\.modernui\.zoom:key\.keyboard\.z$/m);
  assert.match(read('config/modernui/client.toml'), /\[general\]\s+zoom = true/);
  assert.ok(JSON.parse(read('tools/testing/pack_test/data/policy.json')).removedMods.includes('chloride'));
});
