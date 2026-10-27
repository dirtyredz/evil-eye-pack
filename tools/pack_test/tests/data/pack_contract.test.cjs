'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const modId = (file) => path.basename(file, '.pw.toml').replace(/[^a-z0-9]/g, '');

test('pack mod metafiles match the removed and required mod policy', () => {
  const policy = JSON.parse(read('tools/pack_test/data/policy.json'));
  const metafiles = new Set(
    fs.readdirSync(path.join(ROOT, 'mods'), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.pw.toml'))
      .map((entry) => modId(entry.name))
  );

  for (const id of policy.removedMods) {
    assert.equal(metafiles.has(modId(`${id}.pw.toml`)), false, `removed mod ${id} must not have a metafile`);
  }
  for (const id of policy.requiredMods) {
    assert.equal(metafiles.has(modId(`${id}.pw.toml`)), true, `required mod ${id} must have a metafile`);
  }
});

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
