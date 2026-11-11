'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, read, tomlSection } = require('./contract.cjs');

test('the default keymap carries no crafting-grid keys (Crafting Tweaks and the Evil Eye Client keys were removed)', () => {
  const keymap = read('config/defaultoptions/keybindings.txt');
  assert.doesNotMatch(keymap, /^key_key\.craftingtweaks\./m);
  assert.doesNotMatch(keymap, /^key_key\.evileye_client\.crafting\./m);
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


test('Evil Eye Essentials carries the FTB Essentials pack values and imports its data', () => {
  assert.match(read('mods/evileye-essentials.pw.toml'), /^side = "both"$/m);
  for (const gone of ['mods/ftb-essentials.pw.toml', 'mods/ftb-library-forge.pw.toml', 'defaultconfigs/ftbessentials-server.snbt', 'config/sidebar_buttons.json']) {
    assert.equal(fs.existsSync(path.join(ROOT, gone)), false, `${gone} was replaced`);
  }
  const config = read('config/evileye_essentials-common.toml');
  assert.match(tomlSection(config, 'teleportation.home'), /^\s*max = 3$/m);
  for (const command of ['home', 'back', 'spawn', 'tpa']) {
    const section = tomlSection(config, `teleportation.${command}`);
    assert.match(section, /^\s*enabled = true$/m, `${command} enabled`);
    assert.match(section, /^\s*cooldown = 60$/m, `${command} cooldown`);
  }
  assert.match(tomlSection(config, 'teleportation.rtp'), /^\s*enabled = false$/m);
  for (const admin of ['fly', 'god', 'heal', 'feed', 'extinguish', 'speed']) {
    assert.match(tomlSection(config, `admin.${admin}`), /^\s*enabled = true$/m, `${admin} enabled`);
  }
  assert.match(tomlSection(config, 'misc.trashcan'), /^\s*enabled = true$/m);
  assert.match(tomlSection(config, 'import'), /^\s*ftbOnServerStart = true$/m);
});


test('Cosmetic Armor Reworked is replaced by the equipment panel: metafile, configs and texture gone, owned configs present', () => {
  for (const gone of ['mods/cosmetic-armor-reworked.pw.toml', 'config/cosmeticarmorreworked-client.toml', 'config/cosmeticarmorreworked-common.toml',
    'resourcepacks/evil-eye-cozy-overrides/assets/cosmeticarmorreworked']) {
    assert.equal(fs.existsSync(path.join(ROOT, gone)), false, `${gone} was removed`);
  }
  const tweaks = tomlSection(read('config/evileye_tweaks-common.toml'), 'cosmeticArmor');
  assert.match(tweaks, /^\s*shown = true$/m);
  assert.match(tweaks, /^\s*keepThroughDeath = false$/m);
  const client = read('config/evileye_client-client.toml');
  assert.match(tomlSection(client, 'equipment'), /^\s*enabled = true$/m);
  assert.match(tomlSection(client, 'cosmeticArmor'), /^\s*showCosmetics = true$/m);
});


test('owned inventory actions replace IPN and libIPN while retaining Kotlin', () => {
  for (const gone of ['inventory-profiles-next', 'libipn']) assert.equal(fs.existsSync(path.join(ROOT, 'mods/'+gone+'.pw.toml')),false);
  assert.ok(fs.existsSync(path.join(ROOT,'mods/kotlin-for-forge.pw.toml')));
  assert.equal(fs.existsSync(path.join(ROOT,'config/inventoryprofilesnext/inventoryprofiles.json')),false);
  for(const file of ['config/evileye_client-client.toml','config/evileye_tweaks-common.toml'])
    for(const section of ['sorting','transfer','refill']) assert.match(tomlSection(read(file),section),/^\s*enabled = true$/m);
  assert.match(read('config/defaultoptions/keybindings.txt'),/^key_key.evileye_client.sort:key.mouse.middle$/m);
  // Exact local pins are covered across source, lock and metafiles by local_pin_consistency.
  assert.match(read('mods/evileye-client.pw.toml'), /^side = "client"$/m);
  assert.match(read('mods/evileye-client.pw.toml'), /^mode = "metadata:local"$/m);
  for (const mod of ['client', 'tweaks', 'essentials'])
    assert.ok(fs.existsSync(path.join(ROOT, `mods/evileye-${mod}.pw.toml`)));
});


test('Modern UI supplies enabled Z zoom after Chloride retirement', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'mods/chloride.pw.toml')), false);
  assert.equal(fs.existsSync(path.join(ROOT, 'config/chloride-client.toml')), false);
  for (const mod of ['modern-ui', 'quick-skin', '3dskinlayers', 'sodium']) {
    assert.ok(fs.existsSync(path.join(ROOT, `mods/${mod}.pw.toml`)), mod);
  }
  const keys = read('config/defaultoptions/keybindings.txt');
  assert.doesNotMatch(keys, /chloride/);
  assert.match(keys, /^key_key\.modernui\.zoom:key\.keyboard\.z$/m);
  assert.match(read('config/modernui/client.toml'), /\[general\]\s+zoom = true/);
  assert.ok(JSON.parse(read('tools/testing/pack_test/data/policy.json')).removedMods.includes('chloride'));
});

test('Pro Placer is replaced by the client-only owned mod while its shared library remains', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'mods/pro-placer.pw.toml')), false);
  assert.ok(fs.existsSync(path.join(ROOT, 'mods/evileye-client.pw.toml')));
  assert.match(read('mods/evileye-client.pw.toml'), /^side = "client"$/m);
  for (const name of ['puzzles-lib', 'diagonal-fences', 'modern-ui', 'quick-skin', '3dskinlayers']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'mods', name + '.pw.toml')), name + ' remains');
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
  const config = tomlSection(read('config/evileye_client-client.toml'), 'placement');
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
