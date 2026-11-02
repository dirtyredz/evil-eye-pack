'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEntries, applyOwnedKeys, setToml } = require('../install/pack_owned_keys.cjs');
const ROOT = path.resolve(__dirname, '../../..');

test('pack-owned keys that target a shipped file match the shipped bytes', () => {
  for (const e of loadEntries().filter(x => x.format === 'json' && fs.existsSync(path.join(ROOT, x.file)))) {
    let node = JSON.parse(fs.readFileSync(path.join(ROOT, e.file), 'utf8'));
    for (const s of e.section) node = node[s];
    assert.equal(node[e.key], e.value, `${e.file} ${e.key} must equal the owned value`);
  }
});

test('IPN indicator flags are forced into a stale preserved Trial config', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owned-'));
  try {
    const file = path.join(dir, 'config/inventoryprofilesnext/inventoryprofiles.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"AutoRefillSettings":{"visual_replace_success_notification":false}}');
    applyOwnedKeys(dir);
    const s = JSON.parse(fs.readFileSync(file, 'utf8')).AutoRefillSettings;
    assert.equal(s.auto_refill_enable_indicator_icons, false);
    assert.equal(s.auto_refill_enable_horbar_indicator_icons, false);
    assert.equal(s.visual_replace_success_notification, false);
    const amend = fs.readFileSync(path.join(dir, 'config/amendments-client.toml'), 'utf8');
    assert.match(amend, /\[misc\]\n\thotbar_slot_animation_speed = 0\.0/);
    assert.deepEqual(applyOwnedKeys(dir), [], 'second run is idempotent');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('TOML setter replaces in place and keeps other tables', () => {
  const out = setToml('[general]\n\ta = 1\n[misc]\n\t#c\n\thotbar_slot_animation_speed = 2.5\n\tb = 2\n',
    { section: ['misc'], key: 'hotbar_slot_animation_speed', value: 0.0 });
  assert.equal(out, '[general]\n\ta = 1\n[misc]\n\t#c\n\thotbar_slot_animation_speed = 0.0\n\tb = 2\n');
});

test('TOML setter handles top-level keys (empty section) without touching tables', () => {
  const stale = '#c\nbackend = "INSTANCING"\nlimitUpdates = true\n\n[flw_backends]\n\tbackend = "x"\n';
  const out = setToml(stale, { section: [], key: 'backend', value: 'DEFAULT' });
  assert.equal(out, '#c\nbackend = "DEFAULT"\nlimitUpdates = true\n\n[flw_backends]\n\tbackend = "x"\n');
  assert.equal(setToml('[t]\n\ta = 1\n', { section: [], key: 'k', value: 'v' }), 'k = "v"\n[t]\n\ta = 1\n');
});

test('Flywheel backend is a registered Flywheel 1.0 id in the shipped config and the owned keys', () => {
  const owned = loadEntries().find(x => x.file === 'config/flywheel-client.toml' && x.key === 'backend');
  assert.equal(owned.value, 'DEFAULT');
  const shipped = fs.readFileSync(path.join(ROOT, 'config/flywheel-client.toml'), 'utf8');
  assert.match(shipped, /^backend = "DEFAULT"$/m, 'legacy "INSTANCING" parses as minecraft:INSTANCING and is not registered');
});
