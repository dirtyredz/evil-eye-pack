'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { familyModel } = require('../../model/families.cjs');
const { categorize, FALLBACK_CATEGORY } = require('../../model/categories.cjs');
const { node, registries } = require('../fixtures.cjs');

test('every family lands in exactly one category', () => {
  const nodes = [node('alpha'), node('alpha-addon', ['alpha']), node('beta'), node('beta-addon', ['beta'])];
  const model = familyModel(nodes, registries(nodes.map(n => n.key)));
  const categories = categorize(model, { alpha: 'Tech & Automation', beta: 'Magic' }, nodes, { mods: {} });
  const placed = categories.flatMap(category => category.entries.filter(entry => entry.type === 'family').map(entry => entry.value.key));
  assert.deepEqual(placed.sort(), model.families.map(family => family.key).sort());
  assert.equal(new Set(placed).size, placed.length);
});
test('unmapped families and standalone mods remain visible in Other / Uncategorised', () => {
  const nodes = [node('known'), node('known-addon', ['known']), node('loose')];
  const model = familyModel(nodes, registries(nodes.map(n => n.key)));
  const categories = categorize(model, {}, nodes, { mods: {} });
  const other = categories.find(category => category.name === FALLBACK_CATEGORY);
  assert.deepEqual(other.entries.map(entry => entry.value.key).sort(), ['known', 'loose']);
  assert.deepEqual(other.unmapped.sort(), ['known', 'loose']);
});
test('category totals count a shared library only once', () => {
  const nodes = [node('alpha'), node('alpha-addon', ['alpha', 'shared-lib']), node('beta'), node('beta-addon', ['beta', 'shared-lib']), node('shared-lib')];
  const regs = registries(nodes.filter(n => n.key !== 'shared-lib').map(n => n.key));
  const model = familyModel(nodes, regs, { 'shared-lib': { kind: 'library/API', reason: 'fixture library' } });
  const timing = { mods: { alpha: { ms: 10 }, beta: { ms: 20 }, 'shared-lib': { ms: 50 } } };
  const categories = categorize(model, { alpha: 'Tech & Automation', beta: 'Tech & Automation' }, nodes, timing);
  const tech = categories.find(category => category.name === 'Tech & Automation');
  assert.equal(tech.categoryCost.ms, 80);
  assert.equal(tech.categoryCost.measured, 3);
});
test('an unknown category name in the mapping is an error', () => {
  const nodes = [node('loose')];
  assert.throws(() => categorize(familyModel(nodes, {}), { loose: 'Not A Category' }, nodes, { mods: {} }), /Unknown category for loose/);
});
