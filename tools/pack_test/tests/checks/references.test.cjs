'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { checkReferences, lootCycles } = require('../../checks/references.cjs');

const ROOT = path.resolve(__dirname, '../../../..');

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

test('pack policy rejects every retired celestial stack mod', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/pack_test/data/policy.json'), 'utf8'));
  for (const id of ['enhancedcelestials', 'dataanchor', 'corgilib', 'corgikubejscompat']) {
    assert.equal(policy.removedMods.includes(id), true, `${id} must remain retired`);
  }
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
