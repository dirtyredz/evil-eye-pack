'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, evaluateAll } = require('../checks/conditions.cjs');

const state = {
  mods: new Set(['minecraft', 'create']),
  items: new Set(['minecraft:stick']),
  itemTags: new Map([['forge:ingots/iron', ['minecraft:iron_ingot']], ['forge:ingots/steel', []]])
};
const modLoaded = (modid) => ({ type: 'forge:mod_loaded', modid });
const empty = (tag) => ({ type: 'forge:tag_empty', tag });

test('mod_loaded reports the absent mod', () => {
  assert.equal(evaluate(modLoaded('create'), state).value, true);
  const r = evaluate(modLoaded('nope'), state);
  assert.equal(r.value, false);
  assert.equal(r.absentMod, 'nope');
});

test('item_exists checks the registry set', () => {
  assert.equal(evaluate({ type: 'forge:item_exists', item: 'minecraft:stick' }, state).value, true);
  assert.equal(evaluate({ type: 'forge:item_exists', item: 'minecraft:nope' }, state).value, false);
});

test('tag_empty is true only for empty or unknown tags', () => {
  assert.equal(evaluate(empty('forge:ingots/steel'), state).value, true);
  assert.equal(evaluate(empty('forge:ingots/iron'), state).value, false);
  assert.equal(evaluate(empty('forge:unknown'), state).value, true);
});

test('not(tag_empty T) is false and names T when T is empty', () => {
  const r = evaluate({ type: 'forge:not', value: empty('forge:ingots/steel') }, state);
  assert.equal(r.value, false);
  assert.deepEqual(r.emptyTags, ['forge:ingots/steel']);
  const ok = evaluate({ type: 'forge:not', value: empty('forge:ingots/iron') }, state);
  assert.equal(ok.value, true);
  assert.deepEqual(ok.emptyTags, []);
});

test('and / or combine values', () => {
  assert.equal(evaluate({ type: 'forge:and', values: [modLoaded('create'), modLoaded('minecraft')] }, state).value, true);
  const a = evaluate({ type: 'forge:and', values: [modLoaded('create'), modLoaded('nope')] }, state);
  assert.equal(a.value, false);
  assert.equal(a.absentMod, 'nope');
  assert.equal(evaluate({ type: 'forge:or', values: [modLoaded('nope'), modLoaded('create')] }, state).value, true);
  const o = evaluate({ type: 'forge:or', values: [modLoaded('nope'), modLoaded('nope2')] }, state);
  assert.equal(o.value, false);
  assert.equal(o.absentMod, 'nope');
});

test('unknown condition types evaluate to null and poison and/or', () => {
  const u = evaluate({ type: 'weird:thing' }, state);
  assert.equal(u.value, null);
  assert.equal(u.unknown, 'weird:thing');
  assert.equal(evaluate({ type: 'forge:and', values: [modLoaded('create'), { type: 'x:y' }] }, state).value, null);
  assert.equal(evaluate(null, state).value, null);
});

test('evaluateAll is an implicit AND', () => {
  assert.equal(evaluateAll([modLoaded('create'), { type: 'forge:true' }], state).value, true);
  assert.equal(evaluateAll([modLoaded('create'), { type: 'forge:false' }], state).value, false);
  assert.equal(evaluateAll([], state).value, true);
  assert.equal(evaluateAll(undefined, state).value, true);
});
