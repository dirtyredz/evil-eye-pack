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

test('every resource-pack id in the Evil Eye Client policy names a pack the NeoForge pack installs', () => {
  const policy = JSON.parse(read('config/evileye_client/resourcepacks.json'));
  const files = new Set(fs.readdirSync(path.join(ROOT, 'resourcepacks'), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return [entry.name];
    const meta = entry.name.endsWith('.pw.toml') ? read(`resourcepacks/${entry.name}`).match(/^filename = "(.+)"$/m) : null;
    return meta ? [meta[1]] : [];
  }));
  const mods = fs.readdirSync(path.join(ROOT, 'mods')).filter((f) => f.endsWith('.pw.toml')).map(modId);
  const ids = [...policy.default_packs, ...Object.keys(policy.pack_overrides || {})];
  assert.ok(ids.includes('file/Eat Quiet 1.0.0_1.20-1.21.zip'), 'Eat Quiet stays in the policy');
  for (const id of ids) {
    if (id.startsWith('file/')) {
      assert.ok(files.has(id.slice('file/'.length)), `${id} is not an installed resource pack`);
    } else {
      const ns = /^mod\/([a-z0-9_.-]+):/.exec(id);
      assert.ok(ns && mods.includes(ns[1].replace(/[^a-z0-9]/g, '')), `${id} is not a NeoForge mod pack id of an installed mod`);
    }
  }
  assert.equal(policy.pack_overrides['file/Eat Quiet 1.0.0_1.20-1.21.zip'].required, true);
  assert.equal(policy.pack_overrides['file/New Hearts 1.9-15w49b.zip'].force_compatible, true);
});

test('the default keymap names Evil Eye Client crafting keys, not the removed Crafting Tweaks', () => {
  const keymap = read('config/defaultoptions/keybindings.txt');
  assert.doesNotMatch(keymap, /^key_key\.craftingtweaks\./m);
  assert.match(keymap, /^key_key\.evileye_client\.crafting\.compress_stack:key\.keyboard\.k$/m);
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
