'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('owned keys leave every strictly pack-owned shipped target byte-identical', t => {
  const { parseIndex } = require('../../../../packwiz/pack_index.cjs');
  const { loadEntries, applyOwnedKeys } = require('../../../../packwiz/install/owned_keys/pack_owned_keys.cjs');
  const { isStrictlyPackOwned } = require('../../../../packwiz/install/installed_files.cjs');
  const strict = new Set(parseIndex(read('index.toml')).files.filter(isStrictlyPackOwned).map(f => f.file));
  const entries = loadEntries().filter(e => strict.has(e.file));
  const scratch = path.join(ROOT, '.tmp');
  fs.mkdirSync(scratch, { recursive: true });
  const copy = fs.mkdtempSync(path.join(scratch, 'owned-contract-'));
  t.after(() => fs.rmSync(copy, { recursive: true, force: true }));
  const targets = [...new Set(entries.map(e => e.file))];
  for (const file of targets) {
    fs.mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(copy, file));
  }
  assert.deepEqual(applyOwnedKeys(copy, entries), [], 'owned keys must not cause repair loops');
  for (const file of targets) assert.deepEqual(fs.readFileSync(path.join(copy, file)), fs.readFileSync(path.join(ROOT, file)), file);
});

test('pack-owned keys that target a shipped file match the shipped bytes', () => {
  const { loadEntries } = require('../../../../packwiz/install/owned_keys/pack_owned_keys.cjs');
  for (const e of loadEntries().filter(x => x.format === 'json' && fs.existsSync(path.join(ROOT, x.file)))) {
    let node = JSON.parse(read(e.file));
    for (const s of e.section) node = node[s];
    assert.equal(node[e.key], e.value, `${e.file} ${e.key} must equal the owned value`);
  }
});

test('Flywheel backend is a registered Flywheel 1.0 id in the shipped config and the owned keys', () => {
  const { loadEntries } = require('../../../../packwiz/install/owned_keys/pack_owned_keys.cjs');
  const owned = loadEntries().find(x => x.file === 'config/flywheel-client.toml' && x.key === 'backend');
  assert.equal(owned.value, 'DEFAULT');
  assert.match(read('config/flywheel-client.toml'), /^backend = "DEFAULT"$/m, 'legacy "INSTANCING" parses as minecraft:INSTANCING and is not registered');
});

test('shipped Evil Eye Client config already carries the owned rail and left-effects values', () => {
  const shipped = read('config/evileye_client-client.toml');
  for (const [section, key, value] of [
    ['effects.inventory', 'screenSideRight', 'false'],
    ['actionRail', 'enabled', 'true'], ['actionRail', 'side', '"RIGHT"'],
    ['actionRail', 'offsetX', '0'], ['actionRail', 'offsetY', '0']
  ]) {
    const table = shipped.split(`[${section}]`)[1]?.split(/\n\s*\[/)[0];
    assert.match(table, new RegExp(`^\\s*${key} = ${value}$`, 'm'), `${section} ${key}`);
  }
});

test('shipped heart palette has the pink second row and equals the owned colours', () => {
  const { loadEntries } = require('../../../../packwiz/install/owned_keys/pack_owned_keys.cjs');
  const shipped = JSON.parse(read('config/evileye_client-client.toml').split('[health.hearts]')[1].match(/^\s*colors = (\[.*\])$/m)[1]);
  assert.equal(shipped[0], '#FA7DEB');
  assert.equal(shipped[5], '#F06E14');
  const owned = loadEntries().find(x => x.file === 'config/evileye_client-client.toml' && x.key === 'colors').value;
  assert.deepEqual(shipped, owned);
});

// Historical CurseForge slug differs from the jar's mod ID.
const modId = (file) => file === 'ice-and-fire-dragons.pw.toml' ? 'iceandfire' : path.basename(file, '.pw.toml').replace(/[^a-z0-9]/g, '');

test('pack mod metafiles match the removed and required mod policy', () => {
  const policy = JSON.parse(read('tools/testing/pack_test/data/policy.json'));
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

test('visual overrides survive saved-pack omissions and stay above the UI packs', () => {
  const policy = JSON.parse(read('config/evileye_client/resourcepacks.json'));
  const id = 'file/evil-eye-cozy-overrides';
  // Vanilla 1.21.1 omits a newly compatible pack from setSelected while removing
  // its old incompatible acknowledgement. Required packs are reinserted by the
  // repository; first-launch defaults alone do not protect existing instances.
  assert.deepEqual(policy.pack_overrides[id], {
    required: true, fixed_position: true, default_position: 'TOP'
  });
  assert.equal(policy.default_packs.at(-1), id);
  assert.equal(JSON.parse(read('resourcepacks/evil-eye-cozy-overrides/pack.mcmeta')).pack.pack_format, 34);
});

test('the top override leaves HUD heart sprites to CozyUI+', () => {
  const folder = 'resourcepacks/evil-eye-cozy-overrides/assets/minecraft/textures/gui/sprites/hud/heart';
  assert.equal(fs.existsSync(path.join(ROOT, folder)), false,
    'CozyUI+ owns HUD heart sprites; the override must not ship a heart folder');
});

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

// Values from the removed defaultconfigs/ftbessentials-server.snbt; one TOML section per command.
const tomlSection = (text, name) => {
  const start = text.indexOf(`[${name}]`);
  assert.ok(start >= 0, `missing [${name}]`);
  const rest = text.slice(start + name.length + 2);
  const next = rest.search(/^\s*\[/m);
  return next < 0 ? rest : rest.slice(0, next);
};

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

test('Evil Eye Client keeps operator commands in the sidebar and trash on the rail', () => {
  const sidebar = tomlSection(read('config/evileye_client-client.toml'), 'sidebar');
  assert.match(sidebar, /^\s*enabled = true$/m);
  assert.match(sidebar, /^\s*position = "TOP_LEFT"$/m);
  assert.match(sidebar, /^\s*columns = 4$/m);
  assert.match(sidebar, /^\s*buttons = \["gamemode", "day", "night", "rain"\]$/m);
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

test('FPS defaults remain opt-in with a string corner and no forced personal HUD choices', () => {
  const fps = tomlSection(read('config/evileye_client-client.toml'), 'fps');
  for (const key of ['enabled', 'showMin', 'showAverage']) assert.match(fps, new RegExp(`^\\s*${key} = false$`, 'm'));
  assert.match(fps, /^\s*corner = "TOP_LEFT"$/m);
  for (const key of ['offsetX', 'offsetY']) assert.match(fps, new RegExp(`^\\s*${key} = 4$`, 'm'));
  const owned = JSON.parse(read('tools/packwiz/install/owned_keys/pack-owned-keys.json')).keys;
  assert.equal(owned.some(e => e.file === 'config/evileye_client-client.toml' && e.section[0] === 'fps'), false);
  assert.equal(owned.find(e => e.section[0] === 'actionRail' && e.key === 'side').value, 'RIGHT');
});
