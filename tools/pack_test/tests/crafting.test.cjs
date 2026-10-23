'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateCraft, checkCrafting } = require('../checks/crafting.cjs');

const fx = { name: 'torch', recipe: 'minecraft:torch', grid: [], expect: { id: 'minecraft:torch', count: 4 } };
const good = { name: 'torch', ok: true, recipe: 'minecraft:torch', result: { id: 'minecraft:torch', count: 4 }, grid: [] };
const codes = (list) => list.map((f) => f.code);

test('a correct craft has no findings', () => {
  assert.deepEqual(evaluateCraft(fx, good), []);
});

test('wrong recipe, wrong output id and wrong count', () => {
  assert.deepEqual(codes(evaluateCraft(fx, { ...good, recipe: 'other:torch' })), ['craft-wrong-recipe']);
  assert.deepEqual(codes(evaluateCraft(fx, { ...good, result: { id: 'minecraft:torch', count: 1 } })), ['craft-wrong-output']);
  assert.deepEqual(codes(evaluateCraft(fx, { ...good, result: { id: 'minecraft:stick', count: 4 } })), ['craft-wrong-output']);
});

test('nbt is compared only when the fixture expects it', () => {
  const withNbt = { ...fx, expect: { ...fx.expect, nbt: '{a:1}' } };
  assert.deepEqual(codes(evaluateCraft(withNbt, good)), ['craft-wrong-nbt']);
  assert.deepEqual(evaluateCraft(withNbt, { ...good, result: { ...good.result, nbt: '{a:1}' } }), []);
});

test('leftover inputs are craft-inputs-not-consumed', () => {
  const got = { ...good, grid: [{ slot: 2, id: 'minecraft:stick', count: 1 }] };
  assert.deepEqual(codes(evaluateCraft(fx, got)), ['craft-inputs-not-consumed']);
});

test('an expected bucket remainder in slot 1 passes; a missing one fails', () => {
  const cake = { ...fx, remainders: [{ slot: 1, id: 'minecraft:bucket', count: 1 }] };
  assert.deepEqual(evaluateCraft(cake, { ...good, grid: [{ slot: 1, id: 'minecraft:bucket', count: 1 }] }), []);
  assert.deepEqual(codes(evaluateCraft(cake, good)), ['craft-inputs-not-consumed']);
});

test('probe error and missing result', () => {
  assert.deepEqual(codes(evaluateCraft(fx, { name: 'torch', ok: false, error: 'no container' })), ['craft-error']);
  assert.equal(evaluateCraft(fx, { name: 'torch', ok: false, error: 'no container' })[0].message, 'no container');
  assert.deepEqual(codes(evaluateCraft(fx, undefined)), ['craft-not-run']);
});

test('checkCrafting matches results to fixtures by name and counts failures', () => {
  const fx2 = { ...fx, name: 'other' };
  const r = checkCrafting([good], [fx, fx2]);
  assert.equal(r.state, 'findings');
  assert.deepEqual(codes(r.findings), ['craft-not-run']);
  assert.deepEqual(r.stats, { crafts: 2, failed: 1 });
  assert.equal(checkCrafting([good], [fx]).state, 'passed');
  assert.equal(checkCrafting(undefined, [fx]).findings[0].code, 'craft-not-run');
});
