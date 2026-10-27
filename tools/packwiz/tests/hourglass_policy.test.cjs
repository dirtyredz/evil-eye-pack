'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('Hourglass is pinned for both sides with the intended day, night and sleep policy', () => {
  const meta = read('mods/hourglass.pw.toml');
  assert.match(meta, /^filename = "hourglass-1\.20-1\.2\.1\.1\.jar"$/m);
  assert.match(meta, /^side = "both"$/m);
  assert.match(meta, /^mod-id = "1ZqmoFFP"$/m);
  assert.match(meta, /^version = "G7VDa3zX"$/m);

  const config = read('defaultconfigs/hourglass-server.toml');
  assert.match(config, /^\s*daySpeed = 0\.5$/m);
  assert.match(config, /^\s*nightSpeed = 1\.0$/m);
  assert.match(config, /^\s*enableSleepFeature = false$/m);
});

test('retired celestial mods are absent while the KubeJS race workaround remains', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'mods/enhanced-celestials.pw.toml')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'mods/data-anchor.pw.toml')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'mods/corgilib.pw.toml')), true);
  assert.equal(fs.existsSync(path.join(ROOT, 'mods/corgikubejscompat.pw.toml')), true);
});
