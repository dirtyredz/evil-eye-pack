'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { retiredIds } = require('../policy.cjs');
test('retired ids preserve order and overlap, exclude hiddenOnly, and match the shipped KubeJS mirror', () => {
  const policy = { replacements: { 'a:one': 'b:one', 'a:two': 'b:two' }, disabled: ['a:two', 'a:three'], hiddenOnly: ['a:hidden'] };
  const before = JSON.stringify(policy);
  const removed = [];
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../../../kubejs/server_scripts/dedup.js'), 'utf8'), {
    JsonIO: { read: name => name.endsWith('dedup.json') ? policy : { itemTags: {}, blockTags: {} } },
    ServerEvents: { recipes() {}, tags(type, callback) { if (type === 'item') callback({ removeAllTagsFrom: id => removed.push(id) }); } }
  });
  assert.deepEqual(retiredIds(policy), ['a:one', 'a:two', 'a:two', 'a:three']);
  assert.deepEqual(removed, retiredIds(policy));
  assert.equal(JSON.stringify(policy), before);
  assert.deepEqual(retiredIds({ replacements: {}, disabled: [] }), []);
});
