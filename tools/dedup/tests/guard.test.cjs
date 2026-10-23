'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTags, duplicateGroups } = require('../catalog.cjs');
const { plan } = require('../overrides.cjs');
test('loot rewriting covers both vanilla type spellings without changing block predicates', () => {
  const file = 'data/example/loot_tables/blocks/copper.json';
  const original = { pools: [{ entries: [
    { type: 'item', name: 'old:copper', weight: 5 },
    { type: 'minecraft:item', name: 'old:copper', conditions: [{ block: 'old:copper' }] }
  ] }] };
  const policy = { replacements: { 'old:copper': 'keep:copper' }, disabled: [], removeOutputs: [], extraItemTags: {} };
  const result = plan(new Map([[file, original]]), policy).overrides.get('kubejs/' + file);
  assert.equal(result.pools[0].entries[0].name, 'keep:copper');
  assert.equal(result.pools[0].entries[0].weight, 5);
  assert.equal(result.pools[0].entries[1].name, 'keep:copper');
  assert.equal(result.pools[0].entries[1].conditions[0].block, 'old:copper');
});
test('material guard detects new groups and nested tags without counting strata as duplicates', () => {
  const data = new Map([
    ['data/forge/tags/items/ores/copper.json', { values: ['minecraft:copper_ore', 'minecraft:deepslate_copper_ore'] }],
    ['data/forge/tags/items/ingots/new_metal.json', { values: ['first:new_metal', '#other:nested'] }],
    ['data/other/tags/items/nested.json', { values: [{ id: 'second:new_metal', required: false }, '#other:cycle'] }],
    ['data/other/tags/items/cycle.json', { values: ['#other:nested'] }]
  ]);
  assert.deepEqual(duplicateGroups(resolveTags(data, 'items')), { 'forge:ingots/new_metal': ['first', 'second'] });
  assert.deepEqual(duplicateGroups(resolveTags(data, 'items', new Set(['second:new_metal']))), {});
  data.get('data/forge/tags/items/ores/copper.json').values.push('third:copper_ore');
  assert.deepEqual(duplicateGroups(resolveTags(data, 'items'))['forge:ores/copper'], ['minecraft', 'third']);
});
