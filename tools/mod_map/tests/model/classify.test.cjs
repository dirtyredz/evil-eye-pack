'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, classifyAll, isLibrary } = require('../../model/classify.cjs');
const { cost } = require('../../model/cost.cjs');
const { node } = require('../fixtures.cjs');

test('classification has evidence; unknown and client timing never become zero', () => {
  const n = node('a');
  assert.equal(classify(n.mods[0], n, true, { items: [], blocks: [], entities: [] }).kind, 'library/API');
  assert.equal(classify(n.mods[0], { ...n, side: 'client' }, true, {}).kind, 'client-only/cosmetic');
  assert.equal(cost([n], { mods: {} }).ms, null);
});
test('overrides carry kind, reason and pack-wide fix into the classification', () => {
  const n = node('fix');
  const c = classify(n.mods[0], n, false, {}, { fix: { kind: 'performance', reason: 'fixture', packWideFix: 'fixes attributes' } });
  assert.equal(c.kind, 'performance');
  assert.equal(c.evidence, 'checked-in override: fixture');
  assert.equal(c.packWideFix, 'fixes attributes');
});
test('isLibrary needs at least one mod and every mod a library', () => {
  const lib = node('lib'), user = node('user', ['lib']), empty = { ...node('empty'), mods: [] };
  const classifications = classifyAll([lib, user, empty], { items: ['user:item'], blocks: [], entities: [] });
  assert.equal(isLibrary(classifications, lib), true);
  assert.equal(isLibrary(classifications, user), false);
  assert.equal(isLibrary(classifications, empty), false);
  assert.equal(isLibrary(classifications, node('unknown')), false);
});
