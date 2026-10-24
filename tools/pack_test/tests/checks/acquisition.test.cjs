'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkAcquisition } = require('../../checks/acquisition.cjs');
const { compilePolicy, packConfigFiles, loadToolData } = require('../../verdict/policy.cjs');

const noPolicy = { exclude: { ids: {}, patterns: [] } };
const tbl = (items = [], tags = []) => ({ items, tags, tables: [], blocks: [], opaque: [] });
function run(over, policy = noPolicy) {
  const loot = over.loot || {};
  const input = {
    recipeOutputs: new Map(), worldgenBlocks: [], blockItems: new Map(), ...over, loot,
    live: { items: new Set(over.items), lootTables: new Set(over.loaded || Object.keys(loot)), itemTags: new Map(over.itemTags || []) }
  };
  return checkAcquisition(input, policy);
}
const byCode = (r) => Object.fromEntries(r.findings.map((f) => [f.subject, f.code]));

test('recipe output, chest loot and entity loot all cover an item', () => {
  const r = run({
    items: ['a:r', 'a:c', 'a:e'],
    recipeOutputs: new Map([['a:r', ['x:recipe']]]),
    loot: { 'a:chests/vault': tbl(['a:c']), 'a:entities/boss': tbl(['a:e']) }
  });
  assert.deepEqual(r.findings, []);
  assert.equal(r.stats.covered, 3);
});

test('a block table counts only for worldgen blocks, or when the block item is obtainable', () => {
  const r = run({
    items: ['a:ore_drop', 'a:sapling', 'a:leaves', 'a:selfonly'],
    worldgenBlocks: ['a:ore'],
    recipeOutputs: new Map([['a:leaves', ['x:r']]]),
    loot: { 'a:blocks/ore': tbl(['a:ore_drop']), 'a:blocks/leaves': tbl(['a:sapling']), 'a:blocks/selfonly': tbl(['a:selfonly']) }
  });
  assert.deepEqual(byCode(r), { 'a:selfonly': 'unverified-source' });
  assert.equal(r.findings[0].severity, 'info');
  assert.equal(r.state, 'passed');
});

test('blockItems maps a block id to a differently named item for the fixed point', () => {
  const r = run({
    items: ['a:seeds', 'a:wheat_item'],
    recipeOutputs: new Map([['a:wheat_item', ['x:r']]]),
    blockItems: new Map([['a:wheat', 'a:wheat_item']]),
    loot: { 'a:blocks/wheat': tbl(['a:seeds']) }
  });
  assert.deepEqual(r.findings, []);
});

test('an item with no evidence fails; unloaded loot tables prove nothing', () => {
  const r = run({ items: ['a:lost', 'a:ghost'], loot: { 'a:chests/x': tbl(['a:ghost']) }, loaded: [] });
  assert.deepEqual(byCode(r), { 'a:ghost': 'no-known-source', 'a:lost': 'no-known-source' });
  assert.equal(r.state, 'findings');
});

test('unnamespaced loot names and tag entries qualify and resolve', () => {
  const r = run({ items: ['minecraft:bow', 'a:tagged'], loot: { 'a:chests/y': tbl(['bow'], ['a:t']) }, itemTags: [['a:t', ['a:tagged']]] });
  assert.deepEqual(r.findings, []);
});

test('exclusions by id, pattern, dedup lists and curated lists skip the item', () => {
  const policy = compilePolicy(
    { exclude: { ids: { 'a:byid': 'creative only' }, patterns: [{ re: '^a:spawn_egg_', reason: 'eggs' }] } },
    { dedup: { replacements: { 'a:old': 'b:new' }, disabled: ['a:off'], hiddenOnly: ['a:hid'] }, hiddenReasons: { 'a:hid': { class: 'creative-technical', evidence: 'Render-state item, not an orphan.' } }, curated: [{ group: 'g', description: 'd', items: ['a:cur'] }] }
  );
  assert.match(policy.exclude.ids['a:old'], /b:new/);
  assert.equal(policy.exclude.ids['a:cur'], 'g: d');
  assert.equal(policy.exclude.ids['a:hid'], 'hidden_reasons.json: creative-technical: Render-state item, not an orphan.');
  const r = run({ items: ['a:byid', 'a:spawn_egg_x', 'a:old', 'a:off', 'a:hid', 'a:cur', 'a:keep'] }, policy);
  assert.equal(r.stats.excluded, 6);
  assert.equal(r.exclusions['a:hid'], policy.exclude.ids['a:hid']);
  assert.equal(r.exclusions['a:spawn_egg_x'], 'eggs');
  assert.deepEqual(byCode(r), { 'a:keep': 'no-known-source' });
});

test('minecraft:air is never checked', () => {
  const r = run({ items: ['minecraft:air'] });
  assert.equal(r.stats.items, 0);
});

test('hidden reasons are required and take precedence over generic exclusions', () => {
  const dedup = { replacements: {}, disabled: [], hiddenOnly: ['a:hidden'] };
  const policy = { exclude: { ids: { 'a:hidden': 'stale generic reason' } } };
  assert.throws(() => compilePolicy(policy, { dedup, curated: [], hiddenReasons: {} }), /hidden_reasons.json: missing class\/evidence for a:hidden/);
  const compiled = compilePolicy(policy, { dedup, curated: [], hiddenReasons: {
    'a:hidden': { class: 'creative-technical', evidence: 'Used only for rendering.' },
    'a:stale': { class: 'unused', evidence: 'Not hidden in this evidence.' }
  } });
  assert.equal(compiled.exclude.ids['a:hidden'], 'hidden_reasons.json: creative-technical: Used only for rendering.');
  assert.equal(compiled.exclude.ids['a:stale'], undefined);
});

test('the real hidden registry supplies every hidden exclusion without duplicate policy ids', () => {
  const dedup = require('../../../../kubejs/config/dedup.json');
  const reasons = require('../../../dedup/hidden_reasons.json').reasons;
  const policy = loadToolData().policy;
  const compiled = compilePolicy(policy, { dedup, curated: [] });
  for (const id of dedup.hiddenOnly) {
    assert.equal(policy.exclude.ids[id], undefined, `duplicate hidden reason in policy.json: ${id}`);
    assert.equal(compiled.exclude.ids[id], `hidden_reasons.json: ${reasons[id].class}: ${reasons[id].evidence}`);
  }
});

test('the pack files copied as evidence follow policy.json curatedLists plus the dedup files', () => {
  assert.deepEqual(packConfigFiles({ curatedLists: ['a.json', 'b.json'] }), ['kubejs/config/dedup.json', 'kubejs/config/dedup_sources.json', 'config/emi-curation/a.json', 'config/emi-curation/b.json']);
  assert.ok(packConfigFiles(loadToolData().policy).includes('config/emi-curation/creative.json'));
});
