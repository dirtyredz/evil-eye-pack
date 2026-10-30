'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const json = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));

test('retired mods and migration layer are absent', () => {
  for (const f of ['mods/ato.pw.toml', 'mods/allthecompressed.pw.toml', 'mods/almostunified.pw.toml',
    'kubejs/config/ato_retirement.json', 'kubejs/server_scripts/ato_retirement.js',
    'kubejs/server_scripts/ato_retirement_swap.js', 'kubejs/data/alltheores', 'config/almostunified',
    'tools/ato_retirement']) assert.equal(fs.existsSync(path.join(root, f)), false, f);
});

test('HammerLib duplicate gears are disabled at recipe and tag sources; its stone gear stays; duplicate BHC drops are disabled', () => {
  const recipes = json('config/hammerlib/recipes/modded/hammerlib.json');
  const tags = json('config/hammerlib/tags/modded/hammerlib.json');
  // The stone gear has no duplicate on 1.21.1 and HammerMicroblocks' saws need #c:gears/stone (boot 5).
  assert.equal(recipes.active['minecraft:crafting']['hammerlib:gears/stone'], true);
  assert.equal(tags.tags['minecraft:item']['c:gears/stone']['hammerlib:gears/stone'], true);
  for (const material of ['wooden', 'copper', 'iron', 'gold', 'diamond', 'netherite']) {
    const id = 'hammerlib:gears/' + material;
    assert.equal(Object.values(recipes.active).find(group => id in group)[id], false, id);
    assert.equal(tags.tags['minecraft:item']['c:gears/' + material][id], false, id);
  }
  // Ice and Fire witherbone is the survivor again.
  assert.match(fs.readFileSync(path.join(root, 'config/bhc-common.toml'), 'utf8'), /boneDropRate = 0\.0$/m);
});

test('Mekanism steel is the only steel (no Dark Steel stand-in); BOP willow door stays out of trapdoor tags', () => {
  const sources = json('kubejs/config/dedup_sources.json').itemTags;
  assert.equal(Object.hasOwn(sources, 'c:ingots/steel'), false, 'Dark Steel is no longer tagged as steel');
  assert.equal(Object.hasOwn(json('kubejs/config/dedup.json').extraItemTags, 'c:ingots/steel'), false);
  for (const tag of ['minecraft:trapdoors', 'minecraft:wooden_trapdoors']) {
    assert.equal(sources[tag].includes('biomesoplenty:willow_door'), false, tag);
    assert.ok(sources[tag].includes('biomesoplenty:willow_trapdoor'), tag);
  }
  assert.equal(fs.existsSync(path.join(root, 'config/simplecorelib-common.toml')), false);
  assert.ok(json('config/resourcepackoverrides.json').default_packs.includes('builtin/towntalk'));
});

test('keymap leaves no in-world clash among the keys fixed by the 2026-10-23 audit', () => {
  const map = Object.fromEntries(fs.readFileSync(path.join(root, 'config/defaultoptions/keybindings.txt'), 'utf8')
    .split('\n').filter(Boolean).map(l => l.split(/:(.*)/s).slice(0, 2)));
  const moved = ['key_key.dankstorage.construction', 'key_key.dankstorage.pickup_mode', 'key_key.astikorcartsredux.slow',
    'key_key.astikorcartsredux.action', 'key_key.jetpack.toggle_active.description', 'key_key.jetpack.toggle_hover.description', 'key_key.cpm.gestureMenu'];
  const values = Object.entries(map).filter(([, v]) => !v.includes('unknown')).map(([, v]) => v);
  assert.equal(new Set(values).size, values.length, 'duplicate key in keybindings.txt');
  for (const k of moved) assert.ok(map[k], k);
  for (const k of ['key_key.mca.skin_library', 'key_keybinding.enderio.probe_mode', 'key_key.nextDestination', 'key_key.modernui.zoom']) assert.equal(map[k], 'key.keyboard.unknown', k);
});
