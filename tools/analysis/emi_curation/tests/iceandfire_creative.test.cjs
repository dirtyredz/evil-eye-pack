'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts, readRepoText } = require('./support/harness.cjs');
test('CLEAN hides unfinished dreadwood items while ALL can restore them', () => {
  const env = { global: {}, logs: [] };
  loadScripts(env, ['diagnostics', 'collections', 'policy']);
  const P = env.global.emiCuration.policy, policy = P.load(readRepoText);
  const ids = ['iceandfire:dreadwood_leaves', 'iceandfire:dreadwood_sapling'];
  const retired = JSON.parse(readRepoText('kubejs/assets/emi/index/stacks/dedup.json')).removed;
  for (const id of ids) {
    assert.equal(P.isStackHidden(policy, { id, isItem: true, nbt: () => null }), true, id);
    assert.ok(!retired.includes('item:' + id), 'ALL can restore ' + id);
  }
  assert.equal(P.isStackHidden(policy, { id: 'iceandfire:dreadwood', isItem: true, nbt: () => null }), false);
});
