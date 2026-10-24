'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { beeOutputs, isBeeOutput, beeProductItems, CONFIGURABLE_ENTITY, CONFIGURABLE_EGG } = require('../checks/bees.cjs');
const { checkLive } = require('../checks/recipes.cjs');
const { recipeOutputs } = require('../checks/snapshot.cjs');

const BC = 'productivebees:bee_conversion';
const BB = 'productivebees:bee_breeding';
const reg = (entities = [CONFIGURABLE_ENTITY], items = [CONFIGURABLE_EGG]) => ({ items: new Set(items), fluids: new Set(), blocks: new Set(), entities: new Set(entities) });
const conv = { id: 'productivebees:bee_conversion/gems/rose_quartz_bee', type: BC, ings: [], out: null, json: { type: BC, source: 'productivebees:diamond', result: 'productivebees:rose_quartz' } };
const breed = { id: 'productivebees:bee_breeding/farmer_bee', type: BB, ings: [], out: null, json: { type: BB, parent1: 'a:b', parent2: 'c:d', offspring: ['productivebees:farmer_bee', 'productivebees:other'] } };

test('beeOutputs reads conversion results and breeding offspring, nothing else', () => {
  assert.deepEqual(beeOutputs(BC, conv.json), ['productivebees:rose_quartz']);
  assert.deepEqual(beeOutputs(BB, breed.json), ['productivebees:farmer_bee', 'productivebees:other']);
  assert.deepEqual(beeOutputs('productivebees:centrifuge', { result: 'x:y' }), []);
  assert.deepEqual(beeOutputs(BC, null), []);
  assert.deepEqual(beeOutputs(BC, { result: { item: 'a:b' } }), []);
});

test('isBeeOutput needs the configurable bee entity and an actual bee output', () => {
  assert.equal(isBeeOutput(conv, 'productivebees:rose_quartz', reg()), true);
  assert.equal(isBeeOutput(conv, 'productivebees:unrelated', reg()), false);
  assert.equal(isBeeOutput(conv, 'productivebees:rose_quartz', reg([])), false);
});

test('checkLive no longer reports bee types as unrecognized outputs', () => {
  const r = checkLive([conv, { ...conv, id: 'other', type: 'x:other', json: { result: 'productivebees:rose_quartz' } }], reg(), new Map());
  assert.deepEqual(r.findings.map((f) => f.subject), ['other']); // a non-bee recipe with the same bare id still reports
  assert.equal(r.stats.beeOutputs, 1);
});

test('bee recipes give the configurable spawn egg as acquisition evidence', () => {
  assert.deepEqual(beeProductItems(conv, reg()), [CONFIGURABLE_EGG]);
  assert.deepEqual(beeProductItems(conv, reg([], [])), []);
  const out = recipeOutputs([conv, breed], reg());
  assert.deepEqual(out.get(CONFIGURABLE_EGG), [conv.id, breed.id]);
  assert.equal(recipeOutputs([conv]).has(CONFIGURABLE_EGG), false);
});
