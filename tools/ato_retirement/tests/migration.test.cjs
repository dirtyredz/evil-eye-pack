'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const json = f => JSON.parse(read(f));
const manifest = () => json('kubejs/config/ato_retirement.json');

test('the documented dead ends and conversions account for the complete pinned item inventory', () => {
  const catalog = json('tools/ato_retirement/tests/catalog.json');
  const map = manifest().conversions;
  const note = read('docs/ato-retirement.md');
  assert.equal(catalog.alltheores.length, 250);
  assert.equal(catalog.modelOnlyMekanism.length, 44);
  assert.equal(catalog.allthecompressedBases.length, 109);
  assert.equal(Object.keys(map).length, 71);
  for (const source of Object.keys(map)) assert.ok(catalog.alltheores.includes(source), source);
  for (const source of catalog.alltheores.filter(id => !map[id])) {
    assert.ok(note.includes('`' + source.split(':')[1] + '`'), source + ' is not documented');
  }
  for (const base of catalog.allthecompressedBases) assert.ok(note.includes('`' + base + '`'), base);
  const {loadScripts, readRepoText} = require('../../emi_curation/tests/harness.cjs');
  const env = {global:{}, logs:[]}; loadScripts(env, ['diagnostics','collections','policy']);
  const policy = env.global.emiCuration.policy;
  const rules = policy.load(readRepoText);
  const compressed = catalog.allthecompressedBases.flatMap(base => Array.from({length:9}, (_, i) => 'allthecompressed:' + base + '_' + (i + 1) + 'x'));
  for (const id of [...catalog.alltheores, ...compressed]) {
    assert.equal(policy.isStackHidden(rules, {id,isItem:true,nbt:()=>null}), false, id);
  }
});

function load(exists = () => true) {
  const handlers = {}, recipes = [];
  const env = { JsonIO: { read: json }, Item: { exists }, console: { info() {} },
    ServerEvents: { recipes: fn => { handlers.recipes = fn; }, afterRecipes: fn => { handlers.after = fn; } } };
  vm.runInNewContext(read('kubejs/server_scripts/ato_retirement.js'), env);
  const event = { shapeless(output, ingredients) { return { id(id) { recipes.push({id, output, ingredients: [...ingredients]}); } }; } };
  return {handlers, recipes, event};
}

test('conversions consume one exact old item and yield one surviving item, never a tag or a loop', () => {
  const h = load(); h.handlers.recipes(h.event);
  assert.ok(h.recipes.length >= 70);
  assert.equal(new Set(h.recipes.map(r => r.id)).size, h.recipes.length);
  for (const r of h.recipes) {
    assert.match(r.ingredients[0], /^(alltheores|allthecompressed):[a-z0-9_]+$/);
    assert.equal(r.ingredients.length, 1);
    assert.match(r.output, /^[a-z_]+:[a-z_/]+$/);
    assert.doesNotMatch(r.output, /^(alltheores|allthecompressed):/);
  }
  const map = Object.fromEntries(h.recipes.map(r => [r.ingredients[0], r.output]));
  for (const [from,to] of Object.entries({
    'alltheores:deepslate_zinc_ore': 'create:deepslate_zinc_ore',
    'alltheores:other_silver_ore': 'iceandfire:silver_ore',
    'alltheores:raw_uranium_block': 'bigreactors:raw_yellorium_block',
    'alltheores:uranium_nugget': 'bigreactors:yellorium_nugget',
    'alltheores:electrum_ingot': 'createaddition:electrum_ingot',
    'alltheores:sapphire': 'iceandfire:sapphire_gem',
    'alltheores:gold_plate': 'create:golden_sheet',
    'alltheores:iron_gear': 'enderio:iron_gear',
    'alltheores:tin_dust': 'enderio:powdered_tin',
  })) assert.equal(map[from], to, from);
  assert.equal(map['alltheores:tin_ingot'], undefined);
});

test('missing items and recipes removed after registration fail loudly', () => {
  const missing = load(id => id !== 'create:zinc_ingot');
  assert.throws(() => missing.handlers.recipes(missing.event), /Unknown item/);
  const h = load(); h.handlers.recipes(h.event);
  h.handlers.after({countRecipes: () => h.recipes.length});
  assert.throws(() => h.handlers.after({countRecipes: () => h.recipes.length - 1}), /Expected .* loaded conversions/);
});

test('AU preserves literal conversion inputs and keeps migration items discoverable', () => {
  for (const file of ['unify','duplicates']) {
    const au = json('config/almostunified/' + file + '.json');
    const ignored = au.ignoredRecipes.map(s => new RegExp('^(?:' + s + ')$'));
    assert.ok(ignored.some(re => re.test('kubejs:ato_retirement/alltheores/zinc_ingot')));
  }
  const au = json('config/almostunified/unify.json');
  assert.equal(au.itemsHidingJeiRei, false);
  assert.equal(au.priorityOverrides['forge:ingots/silver'], 'iceandfire');
  assert.equal(au.priorityOverrides['forge:ingots/electrum'], 'createaddition');
});

test('every AllTheOres biome modifier is disabled, across overworld, Nether and End', () => {
  const dir = 'kubejs/data/alltheores/forge/biome_modifier/alltheores/';
  const names = fs.readdirSync(path.join(root,dir));
  const expected = ['iridium','ruby','sapphire','peridot'];
  for (const m of ['aluminum','lead','nickel','osmium','platinum','silver','tin','uranium','zinc']) {
    for (const suffix of ['', '_nether', '_end']) expected.push(m + suffix);
  }
  assert.deepEqual(names.sort(), expected.map(n => n + '.json').sort());
  for (const file of names) assert.deepEqual(json(dir + file), {type:'forge:none'});
});

test('Large Ore Deposits cannot select AllTheOres through hard-coded ids or shared tags', () => {
  const ores = {zinc:'create:zinc_ore', silver:'iceandfire:silver_ore', uranium:'bigreactors:yellorite_ore', sapphire:'iceandfire:sapphire_ore', gold:'minecraft:gold_ore'};
  for (const [m, id] of Object.entries(ores)) {
    const text = read('config/adlods/Deposits/' + m + '.cfg');
    assert.match(text, /B:enabled=true/);
    assert.equal(text.match(/S:ores <\s*([^\n]+)\s*>/)[1].trim(), id);
  }
  for (const m of ['aluminum','iridium','lead','nickel','osmium','platinum','ruby','tin']) {
    assert.match(read('config/adlods/Deposits/' + m + '.cfg'), /B:enabled=false/);
  }
});

test('ore loot converts Silk Touch and ordinary drops while retaining Fortune and explosion handling', () => {
  const map = manifest().conversions;
  const oreSources = Object.keys(map).filter(id => id.startsWith('alltheores:') && id.endsWith('_ore'));
  assert.equal(oreSources.length, 26);
  for (const id of oreSources) {
    const loot = json('kubejs/data/alltheores/loot_tables/blocks/' + id.split(':')[1] + '.json');
    const children = loot.pools[0].entries[0].children;
    assert.equal(children[0].name, map[id]);
    assert.equal(children[0].conditions[0].predicate.enchantments[0].enchantment, 'minecraft:silk_touch');
    assert.doesNotMatch(children[1].name, /^alltheores:/);
    assert.ok(children[1].functions.some(f => f.function === 'minecraft:apply_bonus'));
    assert.ok(children[1].functions.some(f => f.function === 'minecraft:explosion_decay'));
  }
  for (const material of ['zinc','silver','uranium']) {
    const id = 'alltheores:raw_' + material + '_block';
    const loot = json('kubejs/data/alltheores/loot_tables/blocks/raw_' + material + '_block.json');
    assert.equal(loot.pools[0].entries[0].name, map[id]);
  }
});
