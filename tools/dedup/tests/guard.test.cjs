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
test('allowance check: unexplained, changed and stale groups; exact namespaces only', () => {
  const { compareAllowances } = require('../guard.cjs');
  const allowed = { 'forge:ingots/a': { namespaces: ['x', 'y'], reason: 'kept' }, 'forge:ingots/gone': { namespaces: ['x', 'z'], reason: 'old' } };
  const r = compareAllowances({ 'forge:ingots/a': ['x', 'y', 'z'], 'forge:ingots/b': ['p', 'q'] }, allowed);
  assert.deepEqual(r.unexplained, [{ tag: 'forge:ingots/b', namespaces: ['p', 'q'] }]);
  assert.deepEqual(r.changed, [{ tag: 'forge:ingots/a', namespaces: ['x', 'y', 'z'], allowed: ['x', 'y'] }]);
  assert.deepEqual(r.stale, ['forge:ingots/gone']);
  assert.equal(r.ok, false);
  assert.equal(compareAllowances({ 'forge:ingots/a': ['x', 'y'] }, { 'forge:ingots/a': { namespaces: ['x', 'y'], reason: 'r' } }).ok, true);
  assert.equal(compareAllowances({ 'forge:ingots/a': ['x', 'y'] }, { 'forge:ingots/a': { namespaces: ['x', 'y'] } }).unexplained.length, 1);
});


test('block strip generation filters replacements by catalog membership only', () => {
  const replacements = { 'example:block': 'keep:block', 'example:item': 'keep:item', 'cluttered:item': 'keep:item' };
  const policy = { replacements, disabled: ['example:disabled'], removeOutputs: [], extraItemTags: {} };
  const blocks = new Set(['example:block', 'example:disabled', 'example:unretired']);
  assert.deepEqual(plan(new Map(), policy, blocks).blockTagRemovals, ['example:block']);
});

for (const removals of [['example:retired'], undefined]) test('server block cleanup consumes guarded generated list: ' + removals, () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const handlers = {};
  const policy = { replacements: { 'cluttered:excluded': 'keep:block' }, disabled: [] };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../../kubejs/server_scripts/dedup.js'), 'utf8'), {
    JsonIO: { read: file => file.endsWith('/dedup.json') ? policy : { blockTagRemovals: removals, blockTags: { 'example:tag': ['keep:block'] } } },
    ServerEvents: { recipes() {}, tags: (kind, fn) => { handlers[kind] = fn; } }
  });
  const removed = [], added = {};
  handlers.block({ removeAllTagsFrom: id => removed.push(id), add: (tag, ids) => { added[tag] = ids; } });
  assert.deepEqual(removed, removals || []);
  assert.deepEqual(added, { 'example:tag': ['keep:block'] });
});
