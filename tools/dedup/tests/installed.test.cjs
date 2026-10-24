'use strict';
const { retiredIds } = require('../policy.cjs');
// Real cached-jar gate. Missing inputs are an error, not a silently skipped test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { root, scan, resolveTags, duplicateGroups } = require('../catalog.cjs');
const { plan } = require('../overrides.cjs');
const { compareAllowances } = require('../guard.cjs');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const policy = read('kubejs/config/dedup.json');
const catalog = scan((process.env.DEDUP_MODS || 'C:/Users/dirty/MultiMC/instances/Evil Eye Local/.minecraft/mods').split(';'));
const planned = plan(catalog.data, policy, catalog.blocks);
const sources = read('kubejs/config/dedup_sources.json');
const retired = new Set(retiredIds(policy));

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
    if (file.includes('/loot_tables/')) inspect(planned.overrides.has('kubejs/' + file) ? read('kubejs/' + file) : json, file);
  }
  assert.ok(checked > 1000);
});

test('recipe and tag events remove producers and code-driven loot candidates', () => {
  const handlers = {};
  const recipeHandlers = [];
  for (const script of ['dedup.js', 'uranium.js']) vm.runInNewContext(fs.readFileSync(path.join(root, 'kubejs/server_scripts', script), 'utf8'), {
    JsonIO: { read }, ServerEvents: {
      recipes: fn => { recipeHandlers.push(fn); }, tags: (kind, fn) => { handlers[kind] = fn; }
    }
  });
  const removedRecipes = [], addedRecipes = [];
  const event = { remove: filter => removedRecipes.push(filter) };
  for (const type of ['smelting', 'blasting']) event[type] = (output, input) => ({ id: id => addedRecipes.push({ id, type, output, input }) });
  recipeHandlers.forEach(fn => fn(event));
  assert.deepEqual(removedRecipes.filter(r => r.id).map(r => r.id), sources.removeRecipes);
  assert.deepEqual(addedRecipes, [
    { id: 'kubejs:uranium_ingot', type: 'smelting', output: 'bigreactors:yellorium_ingot', input: 'alexscaves:uranium' },
    { id: 'kubejs:uranium_ingot_blasting', type: 'blasting', output: 'bigreactors:yellorium_ingot', input: 'alexscaves:uranium' },
    { id: 'kubejs:crushed_uranium_ingot', type: 'smelting', output: 'bigreactors:yellorium_ingot', input: 'create:crushed_raw_uranium' },
    { id: 'kubejs:crushed_uranium_ingot_blasting', type: 'blasting', output: 'bigreactors:yellorium_ingot', input: 'create:crushed_raw_uranium' }
  ]);
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
  assert.ok(added['forge:wither_bones'].includes('iceandfire:witherbone'));
  assert.ok(added['forge:nuggets/copper'].includes('create:copper_nugget'));
});

test('every shipped file is free of removed namespace references; deposit survivors stay explicit', () => {
  for (const dir of ['config', 'defaultconfigs', 'kubejs']) {
    for (const entry of fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const file = path.join(entry.parentPath, entry.name);
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /(?:alltheores|allthecompressed|almostunified):/, file);
    }
  }
  for (const [deposit, ore] of Object.entries({ zinc: 'create:zinc_ore', silver: 'iceandfire:silver_ore', uranium: 'bigreactors:yellorite_ore', sapphire: 'iceandfire:sapphire_ore', gold: 'minecraft:gold_ore' })) {
    assert.ok(fs.readFileSync(path.join(root, 'config/adlods/Deposits', deposit + '.cfg'), 'utf8').includes(ore), deposit);
  }
  for (const deposit of ['aluminum', 'iridium', 'lead', 'nickel', 'osmium', 'platinum', 'ruby', 'tin']) {
    assert.match(fs.readFileSync(path.join(root, 'config/adlods/Deposits', deposit + '.cfg'), 'utf8'), /B:enabled=false/, deposit);
  }
});
