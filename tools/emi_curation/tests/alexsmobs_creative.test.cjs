'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadScripts, readRepoText } = require('./support/harness.cjs');
const { resolvePinnedJar } = require('../../packwiz/pinned_jar.cjs');
const { defaultJarDirs } = require('../../dedup/catalog.cjs');
const { listEntries } = require('../../data_io/zip_reader.cjs');
const root = path.resolve(__dirname, '../../..');
test('CLEAN hides exactly the twelve creative End Pirate blocks without retiring them', () => {
  const expected = ['end_pirate_anchor', 'end_pirate_anchor_winch', 'end_pirate_door', 'end_pirate_flag', 'end_pirate_ship_wheel', 'end_pirate_trapdoor', 'phantom_sail', 'purpur_planks', 'purpur_planks_slab', 'purpur_planks_stairs', 'purpur_planks_wall', 'spectre_sail'].map(id => 'alexsmobs:' + id);
  const jar = resolvePinnedJar(readRepoText('mods/alexs-mobs.pw.toml'), defaultJarDirs(root));
  const files = new Set(listEntries(jar.bytes).map(e => e.name));
  const env = { global: {}, logs: [] }; loadScripts(env, ['diagnostics', 'collections', 'policy']);
  const P = env.global.emiCuration.policy, policy = P.load(readRepoText);
  for (const id of expected) {
    assert.ok(files.has('assets/alexsmobs/models/item/' + id.split(':')[1] + '.json'), id);
    assert.equal(P.isStackHidden(policy, { id, isItem: true, nbt: () => null }), true, id);
  }
  assert.deepEqual(JSON.parse(readRepoText('config/emi-curation/alexsmobs-creative.json')).items, expected);
  const retired = JSON.parse(readRepoText('kubejs/assets/emi/index/stacks/dedup.json')).removed;
  for (const id of expected) assert.ok(!retired.includes('item:' + id), 'ALL can restore ' + id);
  assert.equal(P.isStackHidden(policy, { id: 'alexsmobs:banana', isItem: true, nbt: () => null }), false);
});
