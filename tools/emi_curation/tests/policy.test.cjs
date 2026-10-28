'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, readRepoText } = require('./support/harness.cjs');

const env = { global: {}, logs: [] };
loadScripts(env, ['diagnostics', 'collections', 'policy']);
const P = env.global.emiCuration.policy;
const policy = P.load(readRepoText);

const ZOMBIE = { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie' } } } };
const item = (id, nbt) => ({ id, isItem: true, nbt: () => (nbt === undefined ? null : nbt) });
const hidden = (id, nbt) => P.isStackHidden(policy, item(id, nbt));

test('resource id parts preserve namespace, nested paths and colonless fallback', () => {
  const ids = env.global.emiCuration.ids;
  for (const [id, namespace, path] of [
    ['minecraft:stone', 'minecraft', 'stone'],
    ['herbalwitch:decor/seating/chair', 'herbalwitch', 'decor/seating/chair'],
    ['namespace', 'namespace', ''], ['', '', ''], [':path', '', 'path'],
    ['ns:', 'ns', ''], ['ns:path:rest', 'ns', 'path:rest'],
  ]) {
    assert.deepEqual({ ...ids.split(id) }, { namespace, path });
    assert.equal(ids.namespaceOf(id), namespace);
  }
});

test('loads the shipped curation: 1,104 explicit ids plus rules', () => {
  assert.equal(policy.itemIdCount, 1104);
  assert.deepEqual([...policy.idContains], ['spawn_egg']);
  assert.equal(policy.namespaces.dramaticdoors, true);
  assert.equal(policy.displayFiltering, true);
});

test('every explicit family hides its listed ids', () => {
  for (const id of [
    'ae2:creative_item_cell', 'create:creative_motor', 'enderio:creative_power',
    'enderio:clear_glass_a', 'enderio:fused_quartz_red', 'enderio:clear_glass_dnp_white',
    'ae2:red_covered_cable', 'ae2:white_glass_cable', 'ae2:red_paint_ball', 'ae2:red_lumen_paint_ball',
    'connectedglass:borderless_glass_black', 'supplementaries:present_red', 'supplementaries:flag_black',
    'create:white_toolbox', 'create:red_valve_handle', 'create:white_seat',
    'alexscaves:radon_lamp_red', 'alexscaves:rock_candy_red',
    'minecolonies:pirateegg', 'minecolonies:pharaoegg',
  ]) assert.equal(hidden(id), true, id);
});

test('documented uncoloured/base examples and lower tiers stay visible', () => {
  for (const id of [
    'ae2:fluix_covered_cable', 'ae2:fluix_glass_cable', 'ae2:white_paint_ball', 'ae2:white_lumen_paint_ball',
    'connectedglass:borderless_glass', 'supplementaries:present', 'supplementaries:trapped_present',
    'supplementaries:candle_holder', 'supplementaries:candle_holder_soul', 'supplementaries:flag_white',
    'create:brown_toolbox', 'create:copper_valve_handle', 'create:red_seat',
    'alexscaves:radon_lamp_white', 'alexscaves:rock_candy_white',
    'create:zinc_ingot', 'iceandfire:silver_ingot', 'createaddition:electrum_ingot',
    'enderio:clear_glass', 'enderio:clear_glass_e', 'enderio:clear_glass_d', 'enderio:fused_quartz',
    'enderio:empty_soul_vial', 'enderio:powered_spawner', 'minecolonies:blockhutbuilder', 'minecraft:egg',
  ]) assert.equal(hidden(id), false, id);
});

test('any id containing spawn_egg is hidden, including future ones and NBT variants', () => {
  assert.equal(hidden('minecraft:zombie_spawn_egg'), true);
  assert.equal(hidden('somefuturemod:wyvern_spawn_egg'), true);
  assert.equal(hidden('productivebees:spawn_egg_configurable_bee', { EntityTag: { type: 'productivebees:diamond' } }), true);
  assert.equal(hidden('productivebees:spawn_egg_configurable_bee'), true);
});

test('the whole dramaticdoors namespace is hidden; prefixes of it are not', () => {
  assert.equal(hidden('dramaticdoors:tall_oak_door'), true);
  assert.equal(P.isStackHidden(policy, { id: 'dramaticdoors:anything', isItem: false }), true);
  assert.equal(hidden('dramaticdoorsplus:tall_oak_door'), false);
});

test('explicit item lists apply to items only, not same-named non-item stacks', () => {
  assert.equal(P.isStackHidden(policy, { id: 'ae2:creative_item_cell', isItem: false }), false);
});

test('exactly one canonical Zombie Filled Soul Vial and Broken Spawner stay visible', () => {
  for (const id of ['enderio:filled_soul_vial', 'enderio:broken_spawner']) {
    assert.equal(hidden(id, ZOMBIE), false, id + ' zombie');
    // Key order in the stack's NBT must not matter.
    const reordered = { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie' } } } };
    assert.equal(hidden(id, reordered), false);
    assert.equal(hidden(id), true, id + ' without NBT');
    assert.equal(hidden(id, { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie_villager' } } } }), true);
    assert.equal(hidden(id, { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie_horse' } } } }), true);
    assert.equal(hidden(id, { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:skeleton' } } } }), true);
    // Extra NBT (e.g. a captured zombie with health data) is not the canonical example.
    assert.equal(hidden(id, { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie' },
      MaxHealth: { $nbt: 'float', value: 20 } } } }), true);
    assert.equal(hidden(id, { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie', Health: { $nbt: 'float', value: 20 } } } } }), true);
    assert.equal(hidden(id, { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie' } } }, display: {} }), true);
  }
});

test('nbtEquals is structural and order-independent', () => {
  assert.equal(P.nbtEquals({ a: 'x', b: { c: 'y' } }, { b: { c: 'y' }, a: 'x' }), true);
  assert.equal(P.nbtEquals({ a: 'x' }, { a: 'x', b: 'y' }), false);
  assert.equal(P.nbtEquals({ a: ['x', 'y'] }, { a: ['y', 'x'] }), false);
  assert.equal(P.nbtEquals({ a: { $nbt: 'int', value: 1 } }, { a: '1' }), false);
  assert.equal(P.nbtEquals(null, {}), false);
});

test('compile rejects malformed curation', () => {
  const lists = { 'a.json': { schema: 1, items: ['minecraft:stone'] } };
  const base = { schema: 1, itemLists: ['a.json'] };
  assert.throws(() => P.compile({ ...base, schema: 2 }, lists), /schema/);
  assert.throws(() => P.compile({ ...base, itemLists: ['missing.json'] }, lists), /missing item list/);
  assert.throws(() => P.compile(base, { 'a.json': { schema: 1, items: ['minecraft:stone', 'minecraft:stone'] } }), /duplicate/);
  assert.throws(() => P.compile(base, { 'a.json': { schema: 1, items: ['Not An Id'] } }), /invalid id/);
  assert.throws(() => P.compile({ ...base, nbtExceptions: [{ ids: ['a:b'], keepWhenNbtEquals: 'x' }] }, lists), /must be an object/);
});

test('NBT rule compilation preserves duplicate and malformed-rule validation', () => {
  const base = { schema: 1, itemLists: [] };
  const keep = { ids: ['a:b'], keepWhenNbtEquals: {} };
  const hide = { ids: ['a:b'], keys: ['mobId'] };
  const compile = rules => P.compile({ ...base, ...rules }, {});
  assert.throws(() => compile({ nbtExceptions: [keep, keep] }), /duplicate nbt exception id a:b/);
  assert.throws(() => compile({ hideWhenNbtHasKey: [hide, hide] }), /duplicate nbt rule id a:b/);
  assert.throws(() => compile({ nbtExceptions: [keep], hideWhenNbtHasKey: [hide] }), /duplicate nbt rule id a:b/);
  for (const name of ['nbtExceptions', 'hideWhenNbtHasKey']) {
    const rule = name === 'nbtExceptions' ? keep : hide;
    assert.throws(() => compile({ [name]: {} }), new RegExp(name + ' must be an array'));
    assert.throws(() => compile({ [name]: [{ ...rule, ids: 'a:b' }] }), /ids must be an array/);
    assert.throws(() => compile({ [name]: [{ ...rule, ids: ['Invalid'] }] }), /invalid id/);
  }
  assert.throws(() => compile({ hideWhenNbtHasKey: [{ ...hide, keys: [''] }] }), /must be a non-empty string/);
  assert.throws(() => compile({ hideWhenNbtHasKey: [{ ...hide, keys: {} }] }), /keys must be an array/);
  assert.throws(() => compile({ nbtExceptions: [{ ...keep, keepWhenNbtEquals: [] }] }), /must be an object/);
});

test('NBT rules share one map while preserving lazy reads, key presence and hide precedence', () => {
  const p = P.compile({ schema: 1, itemLists: [], namespaces: ['blocked'],
    nbtExceptions: [{ ids: ['a:keep', 'blocked:keep'], keepWhenNbtEquals: {} }],
    hideWhenNbtHasKey: [{ ids: ['a:keys'], keys: ['mobId', 'other'] }, { ids: ['a:none'], keys: [] }],
  }, {});
  assert.deepEqual(JSON.parse(JSON.stringify(p.nbtRules)), {
    'a:keep': { keep: {} }, 'blocked:keep': { keep: {} },
    'a:keys': { hideKeys: ['mobId', 'other'] }, 'a:none': { hideKeys: [] },
  });
  const check = (id, nbt) => P.isStackHidden(p, item(id, nbt));
  assert.equal(check('a:keep', {}), false);
  assert.equal(check('a:keep', null), true);
  for (const value of [null, false, 0, '', {}]) assert.equal(check('a:keys', { mobId: value }), true);
  assert.equal(check('a:keys', { other: 0 }), true);
  assert.equal(check('a:keys', Object.create({ mobId: 'inherited' })), false);
  for (const value of [null, {}, 'mobId', 0]) assert.equal(check('a:keys', value), false);
  assert.equal(check('a:none', { mobId: 'zombie' }), false);
  const unread = () => { throw new Error('must not read NBT'); };
  assert.equal(P.isStackHidden(p, { id: 'blocked:keep', isItem: true, nbt: unread }), true);
  assert.equal(P.isStackHidden(p, { id: 'a:keep', isItem: false, nbt: unread }), false);
});

// ---- Display filtering (REI FilteredStacksVisibilityHandler rule) ----

const H = (id) => ({ id, hidden: true });
const V = (id) => ({ id, hidden: false });
const ing = (...alts) => ({ alts });
const EMPTY = { alts: [], empty: true };
const displayHidden = (inputs, outputs) => P.isDisplayHidden(
  [inputs, outputs], (i) => i.alts, (i) => i.empty === true, (s) => s.hidden);

test('display with an input whose alternatives are all hidden is hidden', () => {
  assert.equal(displayHidden([ing(V('a')), ing(H('b'), H('c'))], [ing(V('out'))]), true);
});

test('mixed visible/hidden alternatives keep the display', () => {
  assert.equal(displayHidden([ing(H('b'), V('c'))], [ing(V('out'))]), false);
});

test('a hidden output hides the display', () => {
  assert.equal(displayHidden([ing(V('a'))], [ing(H('out'))]), true);
});

test('empty ingredients never hide a display', () => {
  assert.equal(displayHidden([EMPTY, ing(V('a'))], [ing(V('out'))]), false);
  assert.equal(displayHidden([{ alts: [] }], [ing(V('out'))]), false);
});

test('catalysts are not examined (callers pass inputs and outputs only)', () => {
  const catalysts = [ing(H('workstation'))];
  assert.equal(displayHidden([ing(V('a'))], [ing(V('out'))]), false);
  assert.equal(catalysts.length, 1);
});

test('multiple outputs: one fully hidden output is enough', () => {
  assert.equal(displayHidden([ing(V('a'))], [ing(V('o1')), ing(H('o2'))]), true);
  assert.equal(displayHidden([ing(V('a'))], [ing(V('o1')), ing(V('o2'))]), false);
});

test('Java-style lists (size/get) are accepted', () => {
  const jl = (arr) => ({ size: () => arr.length, get: (i) => arr[i] });
  const r = P.isDisplayHidden([jl([{ alts: jl([H('x')]) }]), jl([])], (i) => i.alts, () => false, (s) => s.hidden);
  assert.equal(r, true);
});
