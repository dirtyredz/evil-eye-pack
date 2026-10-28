'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMods } = require('../../inventory/mods_toml.cjs');
const { connect } = require('../../model/graph.cjs');
const overrides = require('../../model/overrides.json');
const { node } = require('../fixtures.cjs');

test('custom mods.toml modLoader creates a mandatory Kotlin for Forge edge', () => {
  const [mod] = parseMods('modLoader="kotlinforforge"\n[[mods]]\nmodId="inventoryprofilesnext"\ndisplayName="Inventory Profiles Next"');
  const ipn = node('ipn'); ipn.mods = [mod];
  const kotlin = node('kotlin'); kotlin.mods[0].id = 'kotlinforforge';
  connect([ipn, kotlin]);
  assert.deepEqual(ipn.dependencies, ['kotlin']);
});
test('connection resolves mandatory providers, excludes optional links and reports missing dependencies', () => {
  const a = node('a');
  a.mods[0].dependencies.push({ id: 'base', mandatory: true, side: 'BOTH' }, { id: 'optional', mandatory: false, side: 'BOTH' }, { id: 'missing', mandatory: true, side: 'CLIENT' });
  const warnings = connect([a, node('base'), node('optional')]);
  assert.deepEqual(a.dependencies, ['base']);
  assert.deepEqual(a.optional, ['optional']);
  assert.match(warnings[0], /missing mandatory/);
});
test('hand-kept override adds HammerMicroblocks undeclared HammerMultipart dependency', () => {
  const microblocks = node('microblocks'); microblocks.mods[0].id = 'hammermicroblocks';
  const multipart = node('multipart'); multipart.mods[0].id = 'hammermultipart';
  connect([microblocks, multipart], overrides);
  assert.deepEqual(microblocks.dependencies, ['multipart']);
});
