'use strict';
const { retiredIds } = require('../policy.cjs');
// Real cached-jar gate. Missing inputs are an error, not a silently skipped test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, scan, resolveTags, duplicateGroups, defaultJarDirs } = require('../catalog.cjs');
const { plan } = require('../overrides.cjs');
const { compareAllowances } = require('../guard.cjs');
const { classify } = require('../../data_io/resource_layout.cjs');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const policy = read('kubejs/config/dedup.json');
const catalog = scan(defaultJarDirs());
const planned = plan(catalog.data, policy, catalog.blocks);
const sources = read('kubejs/config/dedup_sources.json');
const retired = new Set(retiredIds(policy));

test('Alex uranium progression survives alongside yellorium and sulfur uses the existing-world survivor', () => {
  const ids = ['uranium', 'uranium_shard', 'uranium_rod', 'block_of_uranium', 'radrock_uranium_ore'];
  for (const id of ids) {
    assert.ok(catalog.models.has('alexscaves:' + id));
    assert.ok(!retired.has('alexscaves:' + id));
  }
  for (const id of ['uranium_from_block', 'uranium_from_shard', 'uranium_shard_from_uranium', 'uranium_rod',
    'furnace/uranium_from_radrock_ore_blasting', 'furnace/uranium_from_radrock_ore_smelting',
    'furnace/uranium_shard_blasting', 'furnace/uranium_shard_smelting']) {
    assert.ok(catalog.data.has('data/alexscaves/recipe/' + id + '.json'), id);
    assert.ok(!sources.removeRecipes.includes('alexscaves:' + id), id);
  }
  assert.ok(policy.extraItemTags['alexscaves:uranium'].includes('bigreactors:raw_yellorium'));
  assert.deepEqual(policy.tagRemovals['c:nuggets/uranium'], ['alexscaves:uranium_shard']);
  assert.deepEqual(policy.tagRemovals['c:storage_blocks/uranium'], ['alexscaves:block_of_uranium']);
  assert.equal(policy.replacements['mekanism:dust_sulfur'], 'alexscaves:sulfur_dust');
  const cooks = [];
  const event = Object.fromEntries(['smelting', 'blasting'].map(kind => [kind, (out, input) => ({ id(id) { cooks.push({ kind, out, input, id }); } })]));
  vm.runInNewContext(fs.readFileSync(path.join(root, 'kubejs/server_scripts/uranium.js'), 'utf8'), { ServerEvents: { recipes(fn) { fn(event); } } });
  assert.equal(cooks.length, 2);
  assert.ok(cooks.every(r => r.out === 'bigreactors:yellorium_ingot' && r.input === 'alexscaves:uranium'));
});

test('Alex r2 supplies painting and concrete tags without pack bridges', () => {
  const paintings = catalog.data.get('data/alexscaves/tags/block/cave_paintings.json');
  assert.equal(paintings.values.length, 29);
  assert.deepEqual(catalog.data.get('data/alexscaves/tags/item/cave_paintings.json'), paintings);
  assert.equal(fs.existsSync(path.join(root, 'kubejs/data/alexscaves/tags/item/cave_paintings.json')), false);
  assert.ok(catalog.data.get('data/c/tags/item/concrete.json').values.includes('#alexscaves:concrete'));
  assert.equal(fs.existsSync(path.join(root, 'kubejs/data/c/tags/item/concrete.json')), false);
  assert.equal(catalog.data.get('data/alexscaves/tags/item/concrete.json').values.length, 16);
});

test('all data overrides match pinned jars, preserving custom counts/chances/conditions', () => {
  assert.ok(planned.overrides.size > 0);
  for (const [file, expected] of planned.overrides) assert.deepEqual(read(file), expected, file);
  assert.equal(Object.hasOwn(policy, 'blockTagRemovals'), false);
  assert.deepEqual(sources, { blockTagRemovals: planned.blockTagRemovals, removeRecipes: planned.removeRecipes, itemTags: planned.itemTags, blockTags: planned.blockTags });
  for (const [source, survivor] of Object.entries(policy.replacements)) {
    assert.ok(catalog.models.has(source), source);
    assert.ok(catalog.models.has(survivor), survivor);
  }
  const hidden = read('kubejs/assets/emi/index/stacks/dedup.json').removed;
  assert.deepEqual(hidden, [...retired, ...policy.hiddenOnly].map(id => 'item:' + id));
});

test('no new duplicate material group in effective pinned jar tags', () => {
  const data = new Map(catalog.data);
  for (const [tag, ids] of Object.entries(sources.itemTags)) {
    const [ns, name] = tag.split(':');
    const file = `data/${ns}/tags/items/${name}.json`;
    data.set(file, { values: [...(data.get(file)?.values || []), ...ids] });
  }
  const tagged = resolveTags(data, 'items', retired);
  for (const [tag, ids] of Object.entries(policy.tagRemovals || {})) tagged.set(tag, (tagged.get(tag) || []).filter(id => !ids.includes(id)));
  const actual = duplicateGroups(tagged);
  const result = compareAllowances(actual, read('tools/dedup/allowed_groups.json'));
  for (const g of result.unexplained) assert.fail(`New duplicate material group ${g.tag}: ${g.namespaces.join(', ')}`);
  for (const g of result.changed) assert.deepEqual(g.namespaces, g.allowed, `New namespace in ${g.tag}`);
  // liveOnly exceptions come from tags the cached-jar scan cannot see (Forge's own); the live pack test guards them.
  const allowed = read('tools/dedup/allowed_groups.json');
  for (const tag of result.stale.filter(tag => !allowed[tag].liveOnly)) assert.fail('Stale exception: ' + tag);
});

test('no effective loot item entry can produce a retired copy, including unqualified vanilla types', () => {
  let checked = 0;
  function inspect(value, file) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'item' || value.type === 'minecraft:item') {
      assert.equal(retired.has(value.name), false, file + ': ' + value.name);
      checked++;
    }
    Object.values(value).forEach(child => inspect(child, file));
  }
  for (const [file, json] of catalog.data) {
    if (classify(file)?.kind === 'loot_tables') inspect(planned.overrides.has('kubejs/' + file) ? read('kubejs/' + file) : json, file);
  }
  assert.ok(checked > 1000);
});

test('recipe and tag events remove producers and code-driven loot candidates', () => {
  const handlers = {};
  const recipeHandlers = [];
  for (const script of ['dedup.js']) vm.runInNewContext(fs.readFileSync(path.join(root, 'kubejs/server_scripts', script), 'utf8'), {
    JsonIO: { read }, ServerEvents: {
      recipes: fn => { recipeHandlers.push(fn); }, tags: (kind, fn) => { handlers[kind] = fn; }
    }
  });
  const removedRecipes = [], addedRecipes = [];
  const event = { remove: filter => removedRecipes.push(filter) };
  for (const type of ['smelting', 'blasting']) event[type] = (output, input) => ({ id: id => addedRecipes.push({ id, type, output, input }) });
  recipeHandlers.forEach(fn => fn(event));
  assert.deepEqual(removedRecipes.filter(r => r.id).map(r => r.id), sources.removeRecipes);
  // Create's own Mekanism-gated crushed-uranium smelting (rewritten to yellorium) replaced uranium.js (2026-10-30).
  assert.deepEqual(addedRecipes, []);
  assert.equal(planned.overrides.get('kubejs/data/create/recipe/smelting/ingot_uranium_compat_mekanism.json').result.id, 'bigreactors:yellorium_ingot');
  const blocks = [], blockAdditions = {};
  handlers.block({ removeAllTagsFrom: id => blocks.push(id), add: (tag, ids) => { blockAdditions[tag] = ids; } });
  assert.deepEqual(blocks, sources.blockTagRemovals);
  assert.deepEqual(blocks, Object.keys(policy.replacements).filter(id => catalog.blocks.has(id)));
  assert.deepEqual(blockAdditions, sources.blockTags);
  const removed = [], added = {};
  const untagged = {};
  handlers.item({ removeAllTagsFrom: id => removed.push(id), add: (tag, ids) => { added[tag] = ids; }, remove: (tag, ids) => { untagged[tag] = ids; } });
  assert.deepEqual(removed, [...retired]);
  assert.deepEqual(untagged, policy.tagRemovals);
  assert.deepEqual(added, sources.itemTags);
  assert.equal(retired.has('bhc:wither_bone'), true);
  assert.deepEqual(added['c:bones/wither'], ['iceandfire:witherbone']);
});

test('every shipped file is free of removed namespace references; deposit survivors stay explicit', () => {
  // defaultconfigs/ is empty since wave 5 (git drops the folder); the other shipped-file scans skip it too.
  for (const dir of ['config', 'defaultconfigs', 'kubejs'].filter((d) => fs.existsSync(path.join(root, d)))) {
    for (const entry of fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const file = path.join(entry.parentPath, entry.name);
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /(?:alltheores|allthecompressed|almostunified):/, file);
    }
  }
  for (const [deposit, ore] of Object.entries({ zinc: 'create:zinc_ore', uranium: 'bigreactors:yellorite_ore', gold: 'minecraft:gold_ore' })) {
    assert.ok(fs.readFileSync(path.join(root, 'config/adlods/Deposits', deposit + '.cfg'), 'utf8').includes(ore), deposit);
  }
  for (const deposit of ['aluminum', 'iridium', 'lead', 'nickel', 'osmium', 'platinum', 'ruby', 'tin']) {
    assert.match(fs.readFileSync(path.join(root, 'config/adlods/Deposits', deposit + '.cfg'), 'utf8'), /B:enabled=false/, deposit);
  }
});

test('Ice and Fire silver survives at every duplicate source', () => {
  for (const id of ['silver_ore', 'deepslate_silver_ore', 'raw_silver', 'silver_ingot', 'silver_nugget', 'silver_block']) {
    assert.equal(policy.replacements['interstellaris:' + id], 'iceandfire:' + id);
    assert.ok(catalog.models.has('iceandfire:' + id));
  }
  assert.deepEqual(read('kubejs/data/interstellaris/neoforge/biome_modifier/add_silver_ore.json'), { type: 'neoforge:none' });
  for (const id of ['silver_dust', 'dirty_silver_dust', 'silver_plate', 'silver_wire', 'silver_clump', 'silver_crystal', 'silver_shard']) assert.ok(!retired.has('interstellaris:' + id));
  for (const [deposit, ore] of [['silver', 'silver_ore'], ['sapphire', 'sapphire_ore']]) assert.ok(fs.readFileSync(path.join(root, 'config/adlods/Deposits', deposit + '.cfg'), 'utf8').includes('iceandfire:' + ore));
  assert.doesNotMatch(JSON.stringify(policy), /myrmex_(desert|jungle)_egg|iceandfire:witherbone\./);
});
