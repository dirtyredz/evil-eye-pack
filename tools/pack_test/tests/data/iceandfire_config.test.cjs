'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
test('CE JSON preserves the pack griefing, dragon and client settings', () => {
  const c = read('config/iceandfire/iaf-common.json');
  for (const [section, key, value] of [['dragon', 'griefing', false], ['dragon', 'tamedGriefing', false], ['dragon', 'digWhenStuck', false], ['dragon', 'fluteDistance', 4], ['dragon', 'canHealFromBiting', true], ['cyclops', 'griefing', false], ['seaSerpent', 'griefing', false], ['worldgen', 'dangerousDistanceLimit', 800], ['pixie', 'stealItems', true], ['troll', 'spawnWeight', 40], ['lich', 'spawnWeight', 2]]) assert.equal(c[section][key], value, section + '.' + key);
  const client = read('config/iceandfire/iaf-client.json').client;
  assert.equal(client.customMainMenu, false);
  assert.equal(client.dragonAuto3rdPerson, true);
  assert.equal(client['siren.shader'], true);
  assert.equal(read('config/jupiter.json').general.loadForgeConfigs, true);
  const policy = read('tools/pack_test/data/policy.json');
  for (const id of ['dank_recipe_transfer', 'roundwood', 'flatworldfix', 'ars_instrumentum', 'alexsmobs', 'alexscaves', 'iceandfire']) assert.ok(policy.requiredMods.includes(id), id);
});
