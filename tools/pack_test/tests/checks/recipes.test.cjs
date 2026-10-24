'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ingredientRefs, declaredOutputs, declaredOutputRefs } = require('../../recipe_json.cjs');
const { checkLive, reconcile, fallbackTags } = require('../../checks/recipes.cjs');

test('ingredientRefs reads items, tags, alternatives and custom types', () => {
  assert.deepEqual(ingredientRefs('{"item":"a:b"}'), { tags: [], items: ['a:b'], custom: [] });
  assert.deepEqual(ingredientRefs('{"tag":"forge:x"}').tags, ['forge:x']);
  const alts = ingredientRefs('[{"item":"a:b"},{"tag":"c:d"}]');
  assert.deepEqual([alts.items, alts.tags], [['a:b'], ['c:d']]);
  assert.deepEqual(ingredientRefs('{"type":"forge:nbt","item_x":1}').custom, ['forge:nbt']);
  assert.equal(ingredientRefs('{bad'), null);
});

test('declaredOutputRefs handles result objects, nested stacks, chances and strings', () => {
  assert.deepEqual(declaredOutputRefs({ result: { item: 'a:b' } }), [{ id: 'a:b', form: 'object' }]);
  const sag = { results: [{ item: { item: 'ender:dust', count: 2 } }, { item: 'a:chance', chance: 0.1 }, { fluid: 'a:water' }] };
  assert.deepEqual(declaredOutputs(sag).sort(), ['a:chance', 'ender:dust']);
  assert.deepEqual(declaredOutputRefs({ result: 'bees:honey_bee' }), [{ id: 'bees:honey_bee', form: 'string' }]);
  assert.deepEqual(declaredOutputs({ outputs: [{ id: 'a:b', count: 1 }] }), ['a:b']);
  assert.deepEqual(declaredOutputs({ results: [{ fluid: 'a:w', amount: 1 }], transitionalItem: { item: 'c:mid' } }), ['c:mid']);
  assert.deepEqual(declaredOutputs(null), []);
});

const reg = { items: new Set(['a:ok', 'a:out']), fluids: new Set(), entities: new Set(), blocks: new Set() };
const rec = (over) => ({ id: 'r:1', type: 'x:t', ings: [], out: 'a:out', ...over });
const ing = (j, over = {}) => ({ j, n: 1, ...over });
const codes = (fs) => fs.map((f) => `${f.code}:${f.severity}`);

test('checkLive: blank slots, live tags and satisfiable alternatives raise nothing', () => {
  const tags = new Map([['c:live', ['a:ok']]]);
  const r = checkLive([rec({ ings: [ing('{}', { empty: true }), ing('{"tag":"c:live"}'), ing('[{"tag":"c:dead"},{"item":"a:ok"}]')] })], reg, tags);
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.blankSlots, 1);
});

test('checkLive: empty tag, unregistered items and custom ingredients', () => {
  const r = checkLive([rec({ ings: [ing('{"tag":"c:dead"}'), ing('{"item":"a:gone"}'), ing('{"type":"x:custom"}', { n: 0 }), ing('{"type":"x:custom"}', { n: 3 })] })], reg, new Map());
  assert.deepEqual(codes(r.findings), ['ingredient-empty-tag:fail', 'ingredient-unsatisfiable:fail', 'ingredient-unsatisfiable:fail']);
  assert.equal(r.findings[0].ref, '#c:dead');
  assert.equal(r.stats.customIngredients, 2);
});

test('checkLive: outputs by form; fluids ignored', () => {
  const recipes = [
    rec({ out: 'a:missing' }),
    rec({ id: 'r:2', out: 'minecraft:air', json: { result: 'x:mystery' } }),
    rec({ id: 'r:3', json: { results: [{ fluid: 'a:lava' }] } })
  ];
  const r = checkLive(recipes, reg, new Map());
  assert.deepEqual(codes(r.findings), ['output-unregistered:fail', 'output-unrecognized:info']);
});

const state = (tags = {}, mods = ['minecraft']) => ({ mods: new Set(mods), items: new Set(), itemTags: new Map(Object.entries(tags)) });
const notEmpty = { type: 'forge:not', value: { type: 'forge:tag_empty', tag: 'forge:steel' } };
const isEmpty = { type: 'forge:tag_empty', tag: 'forge:steel' };

test('reconcile: gated by an empty tag is info without a fallback, fail with one', () => {
  const gated = { 'p:casing': { source: 's', conditions: [notEmpty], outputs: ['p:casing'] } };
  let r = reconcile([], { recipes: gated }, state(), {});
  assert.deepEqual(codes(r.findings), ['recipe-gated-by-empty-tag:info']);
  const withFb = { ...gated, 'p:casing_alt': { source: 's', conditions: [isEmpty], outputs: ['p:casing'] } };
  r = reconcile([{ id: 'p:casing_alt' }], { recipes: withFb }, state(), {});
  assert.deepEqual(codes(r.findings), ['recipe-fallback-active:fail']);
});

test('reconcile: absent mod counts as optional compat; deliberate absence is silent', () => {
  const raw = { 'p:a': { source: 's', conditions: [{ type: 'forge:mod_loaded', modid: 'nope' }], outputs: [] } };
  let r = reconcile([], { recipes: raw }, state(), {});
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.optionalCompat, 1);
  r = reconcile([], { recipes: { 'p:b': { source: 's', type: 't' } } }, state(), { deliberate: new Set(['p:b']) });
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.deliberate, 1);
});

test('reconcile: parse errors split on whether the named namespace is loaded', () => {
  const raw = { recipes: { 'p:x': { source: 's' }, 'p:y': { source: 's' } } };
  const parseErrors = new Map([['p:x', "Unknown item 'gone:thing' in ingredient"], ['p:y', 'Unknown item \'minecraft:thing\'']]);
  const r = reconcile([], raw, state(), { parseErrors });
  assert.deepEqual(codes(r.findings), ['recipe-optional-compat:info', 'recipe-parse-error:fail']);
});

test('reconcile: plain missing recipe is info; malformed recipe JSON fails', () => {
  const r = reconcile([], { recipes: { 'p:z': { source: 's', type: 't' } }, malformed: [{ kind: 'recipes', id: 'p:bad', source: 'jar', error: 'oops' }, { kind: 'loot_tables', id: 'p:l', source: 'j', error: 'e' }] }, state(), {});
  assert.deepEqual(codes(r.findings), ['recipe-not-loaded:info', 'recipe-malformed-json:fail']);
});

test('fallbackTags maps tag -> outputs of recipes that need it empty', () => {
  const m = fallbackTags({ recipes: { 'p:alt': { conditions: [isEmpty], outputs: ['p:a', 'p:b'] }, 'p:x': { conditions: [notEmpty], outputs: ['p:c'] } } });
  assert.deepEqual([...m.get('forge:steel')].sort(), ['p:a', 'p:b']);
  assert.equal(m.size, 1);
});
