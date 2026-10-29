'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../resource_layout.cjs');

test('1.20 and 1.21 data folders map to one canonical kind', () => {
  assert.deepEqual(L.classify('data/x/recipes/a/b.json'), { ns: 'x', kind: 'recipes', folder: 'recipes', layout: '1.20', path: 'a/b', id: 'x:a/b' });
  assert.equal(L.classify('data/x/recipe/a.json').kind, 'recipes');
  assert.equal(L.classify('data/x/recipe/a.json').layout, '1.21');
  assert.equal(L.classify('data/x/loot_table/blocks/a.json').kind, 'loot_tables');
  assert.equal(L.classify('data/c/tags/item/ingots/steel.json').id, 'c:ingots/steel');
  assert.equal(L.classify('data/c/tags/item/ingots/steel.json').kind, 'tags/items');
  assert.equal(L.classify('data/c/tags/block/ores.json').kind, 'tags/blocks');
  assert.equal(L.classify('data/c/tags/fluid/water.json').kind, 'tags/fluids');
  assert.equal(L.classify('data/x/neoforge/biome_modifier/m.json').kind, 'biome_modifier');
  assert.equal(L.classify('data/x/forge/biome_modifier/m.json').layout, '1.20');
  assert.equal(L.classify('data/x/worldgen/placed_feature/f.json').layout, 'both');
  assert.equal(L.classify('data/x/advancements/a.json'), null);
  assert.equal(L.classify('data/x/recipe/a.json', new Set(['loot_tables'])), null);
  assert.equal(L.dataPath('1.21', 'tags/items', 'c', 'ingots/steel'), 'data/c/tags/item/ingots/steel.json');
  assert.equal(L.dataPath('1.20', 'recipes', 'x', 'a'), 'data/x/recipes/a.json');
  assert.throws(() => L.dataPath('1.19', 'recipes', 'x', 'a'), /Unknown data layout/);
  assert.equal(L.layoutFor('1.21.1'), '1.21');
  assert.equal(L.layoutFor('1.20.1'), '1.20');
});

test('data conditions come from neoforge:conditions or Forge conditions', () => {
  assert.deepEqual(L.dataConditions({ 'neoforge:conditions': [{ type: 'neoforge:true' }] }), [{ type: 'neoforge:true' }]);
  assert.deepEqual(L.dataConditions({ conditions: [{ type: 'forge:true' }] }), [{ type: 'forge:true' }]);
  assert.equal(L.dataConditions({}), null);
  assert.equal(L.conditionType({ type: 'neoforge:mod_loaded' }), 'mod_loaded');
  assert.equal(L.conditionType({ type: 'forge:not' }), 'not');
});
