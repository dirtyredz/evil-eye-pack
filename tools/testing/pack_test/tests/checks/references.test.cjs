'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkReferences, lootCycles } = require('../../checks/references.cjs');

const mkLive = (over = {}) => ({
  items: new Set(['minecraft:bow', 'a:item']), blocks: new Set(['a:block']), fluids: new Set(), mods: new Set(['minecraft', 'a']),
  lootTables: new Set(), itemTags: new Map(), blockTags: new Map(), fluidTags: new Map(), ...over
});
const res = (over = {}) => ({ tags: { items: {}, blocks: {}, fluids: {} }, loot: {}, removedRefs: [], malformed: [], ...over });
const v = (id, required = true) => ({ id, required, source: 'jar' });
const tbl = (over = {}) => ({ source: 's', items: [], tags: [], tables: [], blocks: [], opaque: [], ...over });
const codes = (r) => r.findings.map((f) => `${f.code}:${f.severity}`);

test('required missing item in a dropped tag fails; in a loaded tag it is info', () => {
  const resources = res({ tags: { items: { 'a:t': { values: [v('a:gone')] } }, blocks: {}, fluids: {} } });
  assert.deepEqual(codes(checkReferences(resources, mkLive())), ['tag-missing-reference:fail']);
  const r = checkReferences(resources, mkLive({ itemTags: new Map([['a:t', ['a:item']]]) }));
  assert.deepEqual(codes(r), ['tag-reference-unresolved:info']);
  assert.equal(r.state, 'passed');
});

test('optional missing is counted, unnamespaced ids and #refs resolve', () => {
  const resources = res({ tags: { items: { 'a:t': { values: [v('a:gone', false), v('bow'), v('#a:other'), v('#c:live')] }, 'a:other': { values: [] } }, blocks: {}, fluids: {} } });
  const r = checkReferences(resources, mkLive({ itemTags: new Map([['c:live', ['a:item']]]) }));
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.optionalAbsent, 1);
});

test('tags the log already dropped are skipped', () => {
  const resources = res({ tags: { items: { 'a:t': { values: [v('a:gone')] } }, blocks: {}, fluids: {} } });
  const r = checkReferences(resources, mkLive(), { logged: { droppedTags: new Set(['a:t']) } });
  assert.deepEqual(r.findings, []);
});

test('loot table references to missing things each get their own code', () => {
  const live = mkLive({ lootTables: new Set(['a:t']) });
  const resources = res({ loot: { 'a:t': tbl({ items: ['a:item', 'a:nope'], tags: ['a:notag'], tables: ['a:sub', 'minecraft:empty'], blocks: ['a:block', 'a:noblock'] }) } });
  const r = checkReferences(resources, live);
  assert.deepEqual(codes(r).sort(), ['loot-missing-block:fail', 'loot-missing-item:fail', 'loot-missing-table:fail', 'loot-missing-tag:fail']);
});

test('tables that did not load: compat, failed in log, or loot-not-loaded', () => {
  const resources = res({ loot: {
    'a:compat': tbl({ items: ['x:one', 'x:two'] }),
    'a:logged': tbl({ items: ['a:item'] }),
    'a:plain': tbl({ items: ['a:item'] })
  } });
  const r = checkReferences(resources, mkLive(), { logged: { failedLoot: new Set(['a:logged']) } });
  assert.deepEqual(r.findings.map((f) => f.subject), ['a:plain']);
  assert.equal(r.findings[0].code, 'loot-not-loaded');
  assert.equal(r.stats.lootOptionalCompat, 1);
});

test('lootCycles finds a 2-cycle and checkReferences reports it', () => {
  const loot = { 'a:x': tbl({ tables: ['a:y'] }), 'a:y': tbl({ tables: ['a:x'] }), 'a:z': tbl() };
  assert.deepEqual(lootCycles(loot), [['a:x', 'a:y', 'a:x']]);
  const r = checkReferences(res({ loot }), mkLive({ lootTables: new Set(Object.keys(loot)) }));
  assert.deepEqual(codes(r), ['loot-cycle:fail']);
});

test('removed namespaces: raw refs, shipped mentions, registered content, loaded mod', () => {
  const live = mkLive({ items: new Set(['old:thing', 'a:item']), blocks: new Set(['old:blk']), mods: new Set(['old', 'a']) });
  const resources = res({ removedRefs: [{ id: 'a:r', kind: 'recipes', source: 'jar', refs: ['old:thing'] }] });
  const r = checkReferences(resources, live, { removed: ['old'], shipped: [{ file: 'cfg.toml', refs: ['old:x'] }] });
  assert.deepEqual(codes(r).sort(), ['removed-mod-loaded:fail', 'removed-mod-reference:fail', 'removed-mod-reference:fail', 'removed-mod-registered:fail', 'removed-mod-registered:fail']);
});

test('required mods must be present in the live mod registry', () => {
  const missing = checkReferences(res(), mkLive(), { required: ['hourglass'] });
  assert.deepEqual(codes(missing), ['required-mod-missing:fail']);
  const loaded = checkReferences(res(), mkLive({ mods: new Set(['minecraft', 'a', 'hourglass']) }), { required: ['hourglass'] });
  assert.deepEqual(loaded.findings, []);
});

test('malformed non-recipe resources fail; recipe ones are left to the recipe check', () => {
  const r = checkReferences(res({ malformed: [{ kind: 'recipes', id: 'a:r', source: 's', error: 'e' }, { kind: 'loot_tables', id: 'a:l', source: 's', error: 'bad' }] }), mkLive());
  assert.deepEqual(codes(r), ['resource-malformed-json:fail']);
});

test('a loot table whose own neoforge:conditions are false is gated, not missing', () => {
  const { checkReferences } = require('../../checks/references.cjs');
  const live = { items: new Set(), blocks: new Set(), fluids: new Set(), itemTags: new Map(), blockTags: new Map(), fluidTags: new Map(), mods: new Set(['minecraft']), lootTables: new Set() };
  const resources = { tags: { items: {}, blocks: {}, fluids: {} }, loot: {
    'thirst:chests/x': { source: 't.jar', conditions: [{ type: 'neoforge:mod_loaded', modid: 'farmersrespite' }], items: [], tags: [], tables: [], blocks: [], opaque: [] },
    'thirst:chests/y': { source: 't.jar', items: [], tags: [], tables: [], blocks: [], opaque: [] } }, malformed: [] };
  const r = checkReferences(resources, live);
  assert.deepEqual(r.findings.map((f) => f.subject), ['thirst:chests/y']);
  assert.equal(r.stats.lootConditionalOff, 1);
});

test('other-layout data fails unless restored, twinned or reasoned; tags count only their own jar or kubejs', () => {
  const ignoredLayout = [
    { source: 'mca.jar', kind: 'loot_tables', id: 'mca:blocks/grave' },          // restored by kubejs
    { source: 'mca.jar', kind: 'loot_tables', id: 'mca:entities/reaper' },       // lost
    { source: 'ewh.jar', kind: 'loot_tables', id: 'epic:chests/food' },          // the jar's own 1.21 twin
    { source: 'trap.jar', kind: 'tags/blocks', id: 'trap:barn' },                // twin only from another jar: lost
    { source: 'fence.jar', kind: 'tags/blocks', id: 'df:non_diagonal' },         // restored by kubejs
    { source: 'er.jar', kind: 'recipes', id: 'thermal:machine/x' }               // reasoned
  ];
  const resources = res({
    ignoredLayout,
    recipes: {},
    loot: { 'mca:blocks/grave': tbl({ source: 'kubejs' }), 'epic:chests/food': tbl({ source: 'ewh.jar' }) },
    tags: { items: {}, fluids: {}, blocks: {
      'trap:barn': { values: [{ id: 'bop:x', required: true, source: 'bop.jar' }] },
      'df:non_diagonal': { values: [{ id: 'a:block', required: true, source: 'kubejs' }] } } }
  });
  const r = checkReferences(resources, mkLive({ lootTables: new Set(Object.keys(resources.loot)), blockTags: new Map([['trap:barn', ['bop:x']], ['df:non_diagonal', ['a:block']]]) }),
    { ignoredLayout: { 'recipes|thermal:*': 'Thermal is not in the pack' } });
  const layout = r.findings.filter((f) => f.code.startsWith('data-ignored-layout'));
  assert.deepEqual(layout.map((f) => `${f.code}:${f.severity}:${f.subject}:${f.ref}`).sort(), [
    'data-ignored-layout-accepted:info:er.jar:recipes',
    'data-ignored-layout:fail:mca.jar:loot_tables',
    'data-ignored-layout:fail:trap.jar:tags/blocks'
  ]);
  assert.match(layout.find((f) => f.subject === 'mca.jar').message, /^1 loot_tables file\(s\).*mca:entities\/reaper/);
  assert.deepEqual([r.stats.ignoredLayout, r.stats.ignoredLayoutCovered, r.stats.ignoredLayoutAccepted, r.stats.ignoredLayoutLost], [6, 3, 1, 2]);
});

test('ignored-layout policy reports keys that no longer match anything', () => {
  const { triageIgnoredLayout } = require('../../checks/ignored_layout.cjs');
  const t = triageIgnoredLayout([{ source: 'j', kind: 'recipes', id: 'a:x' }], () => false, { 'recipes|a:*': 'r', 'recipes|b:y': 'stale' });
  assert.deepEqual(t.accepted.map((f) => f.reason), ['r']);
  assert.deepEqual(t.unused, ['recipes|b:y']);
});
