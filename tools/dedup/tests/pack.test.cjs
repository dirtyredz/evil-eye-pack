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

test('HammerLib gears are disabled at recipe and tag sources; BHC code drops stay off', () => {
  const recipes = json('config/hammerlib/recipes/modded/hammerlib.json');
  const tags = json('config/hammerlib/tags/modded/hammerlib.json');
  for (const material of ['wooden', 'stone', 'copper', 'iron', 'gold', 'diamond', 'netherite']) {
    const id = 'hammerlib:gears/' + material;
    assert.equal(Object.values(recipes.active).find(group => id in group)[id], false, id);
    assert.equal(tags.tags['minecraft:item']['forge:gears/' + material][id], false, id);
  }
  assert.match(fs.readFileSync(path.join(root, 'config/bhc-common.toml'), 'utf8'), /boneDropRate = 0\.0/);
});
