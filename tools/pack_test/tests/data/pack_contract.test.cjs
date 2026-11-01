'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
// Historical CurseForge slug differs from the jar's mod ID.
const modId = (file) => file === 'ice-and-fire-dragons.pw.toml' ? 'iceandfire' : path.basename(file, '.pw.toml').replace(/[^a-z0-9]/g, '');

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

test('Evil Eye Tweaks keeps the pack day length: half-speed day, vanilla night, vanilla sleep', () => {
  const meta = read('mods/evileye-tweaks.pw.toml');
  assert.match(meta, /^side = "both"$/m);
  assert.equal(fs.existsSync(path.join(ROOT, 'mods/hourglass.pw.toml')), false, 'Hourglass was replaced');

  const config = read('config/evileye_tweaks-common.toml');
  assert.match(config, /^\s*daySpeed = 0\.5$/m);
  assert.match(config, /^\s*nightSpeed = 1\.0$/m);
  assert.match(config, /^\s*weatherEffect = "SLEEPING"$/m);
});
