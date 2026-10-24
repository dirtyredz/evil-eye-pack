'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanResources } = require('../session/resources.cjs');
const { parseLenient, lootRefs } = require('../session/extract.cjs');
const { stageEvidence } = require('../session/evidence.cjs');

test('parseLenient accepts BOM, comments and trailing commas', () => {
  assert.deepEqual(parseLenient(String.fromCharCode(0xfeff) + '{"a":1}'), { json: { a: 1 }, lenient: true });
  const text = '{\n // line\n "a": 1, /* block */\n # hash\n "b": [1,2,],\n}';
  assert.deepEqual(parseLenient(text).json, { a: 1, b: [1, 2] });
});

test('parseLenient keeps comment markers inside strings and rejects garbage', () => {
  assert.equal(parseLenient('{"u":"http://x/y" // c\n,}').json.u, 'http://x/y');
  assert.equal(parseLenient('{"u":"a # b /* c */",}').json.u, 'a # b /* c */');
  assert.throws(() => parseLenient('{nope'));
});

test('lootRefs collects items, tags, tables, children and block predicates', () => {
  const r = lootRefs({
    pools: [{
      conditions: [{ condition: 'minecraft:block_state_property', block: 'a:crop' }],
      entries: [
        { type: 'minecraft:item', name: 'a:i' },
        { type: 'minecraft:tag', name: 'c:t' },
        { type: 'minecraft:loot_table', name: 'a:sub' },
        { type: 'minecraft:alternatives', children: [{ type: 'minecraft:item', name: 'a:child' }], conditions: [{ condition: 'block_state_property', block: 'a:other' }] },
        { type: 'minecraft:dynamic', name: 'minecraft:contents' },
        { type: 'minecraft:empty' }
      ]
    }]
  });
  assert.deepEqual(r.items.sort(), ['a:child', 'a:i']);
  assert.deepEqual(r.tags, ['c:t']);
  assert.deepEqual(r.tables, ['a:sub']);
  assert.deepEqual(r.blocks.sort(), ['a:crop', 'a:other']);
  assert.deepEqual(r.opaque, ['minecraft:dynamic']);
});

function withDirs(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'resources-test-'));
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function put(root, rel, v) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v));
}
const dir = (root, name) => ({ kind: 'dir', name, file: path.join(root, name, 'data') });

test('scanResources reads recipes, loot, worldgen and malformed files from a dir source', () => withDirs((root) => {
  const cond = [{ type: 'forge:mod_loaded', modid: 'gone' }];
  put(root, 'kubejs/data/x/recipes/a.json', { type: 'minecraft:crafting_shaped', conditions: cond, result: { item: 'x:out' } });
  put(root, 'kubejs/data/x/loot_tables/blocks/b.json', { pools: [{ entries: [{ type: 'minecraft:item', name: 'x:drop' }] }] });
  put(root, 'kubejs/data/x/worldgen/configured_feature/f.json', { config: { state: { Name: 'x:ore' } } });
  put(root, 'kubejs/data/x/recipes/bad.json', '{broken');
  const ev = scanResources([dir(root, 'kubejs')]);
  assert.deepEqual(ev.recipes['x:a'], { source: 'kubejs', type: 'minecraft:crafting_shaped', conditions: cond, outputs: ['x:out'] });
  assert.deepEqual(ev.loot['x:blocks/b'].items, ['x:drop']);
  assert.deepEqual(ev.worldgenBlocks, ['x:ore']);
  assert.equal(ev.malformed.length, 1);
  assert.equal(ev.malformed[0].id, 'x:bad');
  assert.equal(ev.malformed[0].kind, 'recipes');
}));

test('tags merge across sources and replace:true resets', () => withDirs((root) => {
  put(root, 'one/data/forge/tags/items/ingots/c.json', { values: ['a:x', { id: 'a:opt', required: false }] });
  put(root, 'two/data/forge/tags/items/ingots/c.json', { values: ['b:y'] });
  let ev = scanResources([dir(root, 'one'), dir(root, 'two')]);
  const t = ev.tags.items['forge:ingots/c'];
  assert.deepEqual(t.values.map((v) => v.id), ['a:x', 'a:opt', 'b:y']);
  assert.equal(t.values[1].required, false);
  assert.equal(t.replaced, false);
  put(root, 'two/data/forge/tags/items/ingots/c.json', { replace: true, values: ['b:y'] });
  ev = scanResources([dir(root, 'one'), dir(root, 'two')]);
  assert.deepEqual(ev.tags.items['forge:ingots/c'].values.map((v) => v.id), ['b:y']);
  assert.equal(ev.tags.items['forge:ingots/c'].replaced, true);
}));

test('removed-namespace mentions are recorded', () => withDirs((root) => {
  put(root, 'kubejs/data/x/recipes/r.json', { type: 't', ingredient: { item: 'oldmod:thing' }, tag: '#oldmod:tag' });
  put(root, 'kubejs/data/x/recipes/clean.json', { type: 't' });
  const ev = scanResources([dir(root, 'kubejs')], { removedNamespaces: ['oldmod'] });
  assert.equal(ev.removedRefs.length, 1);
  assert.equal(ev.removedRefs[0].id, 'x:r');
  assert.deepEqual(ev.removedRefs[0].refs.sort(), ['oldmod:tag', 'oldmod:thing']);
}));

test('stageEvidence saves raw resources, shipped mentions and the selected pack policy files', () => withDirs((root) => {
  const stage = path.join(root, 'stage'), evidence = path.join(root, 'evidence');
  put(stage, 'kubejs/data/x/recipes/r.json', { type: 't', ingredient: { item: 'oldmod:thing' } });
  put(stage, 'config/example.toml', 'item = "oldmod:thing"');
  put(stage, 'kubejs/config/dedup.json', { hiddenOnly: [] });
  put(stage, 'kubejs/config/dedup_sources.json', { removeRecipes: [] });
  put(stage, 'config/emi-curation/selected.json', { items: ['x:one'] });
  put(stage, 'config/emi-curation/unused.json', { items: [] });
  stageEvidence(stage, evidence, { policy: { removedMods: ['oldmod'], curatedLists: ['selected.json'] } });
  const resources = JSON.parse(fs.readFileSync(path.join(evidence, 'resources.json'), 'utf8'));
  assert.equal(resources.recipes['x:r'].type, 't');
  assert.ok(resources.shipped.some((s) => s.file === 'config/example.toml' && s.refs.includes('oldmod:thing')));
  assert.deepEqual(fs.readdirSync(path.join(evidence, 'pack-config')).sort(), ['dedup.json', 'dedup_sources.json', 'selected.json']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(evidence, 'pack-config/selected.json'), 'utf8')), { items: ['x:one'] });
}));
