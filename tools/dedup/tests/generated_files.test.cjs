'use strict';
// Generator ownership: stale generated outputs disappear, hand-written files and hand-edited outputs survive.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const owned = require('../generated_files.cjs');
const { plan } = require('../overrides.cjs');

test('regeneration removes only unmodified files the previous run generated', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dedup-owned-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = path.join(root, 'generated.json');
  const put = (rel, json) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), owned.text(json)); };
  const first = owned.reconcile(root, owned.readManifest(manifest), new Map([
    ['kubejs/data/a/recipes/old.json', { v: 1 }], ['kubejs/data/b/recipes/edited.json', { v: 1 }], ['kubejs/data/b/recipes/kept.json', { v: 1 }]]));
  owned.apply(root, first, manifest);
  put('kubejs/data/a/recipes/handwritten.json', { mine: true });
  fs.writeFileSync(path.join(root, 'kubejs/data/b/recipes/edited.json'), '{"hand": "edit"}\n');
  const second = owned.reconcile(root, owned.readManifest(manifest), new Map([
    ['kubejs/data/b/recipe/kept.json', { v: 2 }], ['kubejs/data/b/recipes/kept.json', { v: 1 }]]));
  assert.deepEqual(second.removes, ['kubejs/data/a/recipes/old.json']);
  assert.deepEqual(second.kept, ['kubejs/data/b/recipes/edited.json']);
  owned.apply(root, second, manifest);
  assert.ok(!fs.existsSync(path.join(root, 'kubejs/data/a/recipes/old.json')));
  assert.ok(fs.existsSync(path.join(root, 'kubejs/data/a/recipes/handwritten.json')), 'hand-written override survives');
  assert.ok(fs.existsSync(path.join(root, 'kubejs/data/b/recipes/edited.json')), 'a hand-edited output is kept and reported');
  assert.deepEqual(Object.keys(owned.readManifest(manifest).files), ['kubejs/data/b/recipe/kept.json', 'kubejs/data/b/recipes/kept.json']);
});

test('overrides follow the source layout and keep components, counts and conditions', () => {
  const policy = { replacements: { 'old:ingot': 'new:ingot' }, removeOutputs: ['gone:thing'], extraItemTags: {}, retired: {} };
  const data = new Map([
    ['data/m/recipe/a.json', { type: 'm:press', 'neoforge:conditions': [{ type: 'neoforge:mod_loaded', modid: 'm' }], ingredients: [{ item: 'old:ingot' }], result: { id: 'm:plate', count: 2, components: { 'minecraft:custom_name': '"x"' } } }],
    ['data/m/recipe/b.json', { type: 'm:press', result: { id: 'gone:thing' } }],
    ['data/m/loot_table/blocks/ore.json', { pools: [{ entries: [{ type: 'minecraft:item', name: 'old:ingot' }] }] }],
    ['data/c/tags/item/ingots/x.json', { values: ['old:ingot'] }]
  ]);
  const r = plan(data, { ...policy, disabled: [] }, new Set());
  const a = r.overrides.get('kubejs/data/m/recipe/a.json');
  assert.deepEqual(a.ingredients, [{ item: 'new:ingot' }]);
  assert.deepEqual(a.result, { id: 'm:plate', count: 2, components: { 'minecraft:custom_name': '"x"' } });
  assert.deepEqual(a['neoforge:conditions'], [{ type: 'neoforge:mod_loaded', modid: 'm' }]);
  assert.deepEqual(r.removeRecipes, ['m:b']);
  assert.equal(r.overrides.get('kubejs/data/m/loot_table/blocks/ore.json').pools[0].entries[0].name, 'new:ingot');
});
