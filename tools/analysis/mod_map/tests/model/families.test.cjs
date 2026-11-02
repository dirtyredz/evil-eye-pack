'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { familyModel } = require('../../model/families.cjs');
const overrides = require('../../model/overrides.json');
const { node, registries } = require('../fixtures.cjs');

test('family nests an add-on of an add-on under its base', () => {
  const nodes = [node('base'), node('addon', ['base']), node('nested', ['addon'])];
  const model = familyModel(nodes, registries(['base', 'addon', 'nested']));
  assert.equal(model.families.length, 1);
  assert.equal(model.families[0].roots[0].key, 'base');
  assert.deepEqual(model.families[0].members.map(n => n.key).sort(), ['addon', 'base', 'nested']);
});
test('bridge add-on belongs to two families', () => {
  const nodes = [node('ars'), node('ae2'), node('ars-addon', ['ars']), node('ae2-addon', ['ae2']), node('bridge', ['ars', 'ae2'])];
  const model = familyModel(nodes, registries(nodes.map(n => n.key)));
  assert.deepEqual([...model.memberships.get('bridge')].sort(), ['ae2', 'ars']);
  assert.equal(model.families.filter(f => f.members.some(n => n.key === 'bridge')).length, 2);
});
test('library with content users never becomes a family root', () => {
  const nodes = [node('framework'), node('one', ['framework']), node('two', ['framework'])];
  const model = familyModel(nodes, registries(['one', 'two']), { framework: { kind: 'library/API', reason: 'fixture framework' } });
  assert.equal(model.families.length, 0);
});
test('shared library is owned by every family user; an orphan library is an unused trim', () => {
  const nodes = [node('alpha'), node('alpha-addon', ['alpha', 'shared-lib']), node('alpha-second', ['alpha', 'shared-lib']), node('beta'), node('beta-addon', ['beta', 'shared-lib']), node('shared-lib'), node('orphan-lib')];
  const model = familyModel(nodes, registries(['alpha', 'alpha-addon', 'alpha-second', 'beta', 'beta-addon']), {
    'shared-lib': { kind: 'library/API', reason: 'fixture library' },
    'orphan-lib': { kind: 'library/API', reason: 'fixture orphan' }
  });
  assert.deepEqual(model.families.map(f => f.libraries.map(n => n.key)), [['shared-lib'], ['shared-lib']]);
  assert.deepEqual([...model.libraryFamilies.get('shared-lib')].sort(), ['alpha', 'beta']);
  assert.deepEqual(model.unusedLibraries.map(n => n.key), ['orphan-lib']);
  assert.ok(!model.ungrouped.some(n => n.key.endsWith('-lib')));
});
test('bundled jar library is neither ungrouped nor an unused trim', () => {
  const skin = node('skinlayers3d', ['bundled:trender']);
  const culling = node('entityculling', ['bundled:trender']);
  const trender = node('bundled:trender');
  trender.embedded = true; trender.providers = [skin.key, culling.key]; trender.mods[0].id = 'trender';
  const model = familyModel([skin, culling, trender], registries(['skinlayers3d', 'entityculling']), overrides);
  assert.ok(!model.ungrouped.includes(trender));
  assert.ok(!model.unusedLibraries.includes(trender));
});
test('override family root and family name group a suite its metadata does not express', () => {
  const nodes = [node('suite-core'), node('suite-blocks')];
  const model = familyModel(nodes, registries(['suite-core', 'suite-blocks']), {
    'suite-core': { family: 'suite', familyName: 'Suite', familyRoot: true, reason: 'fixture' },
    'suite-blocks': { family: 'suite', reason: 'fixture' }
  });
  assert.deepEqual(model.families.map(f => [f.name, f.roots.map(n => n.key), f.members.map(n => n.key).sort()]), [['Suite', ['suite-core'], ['suite-blocks', 'suite-core']]]);
  assert.deepEqual(model.ungrouped, []);
});
