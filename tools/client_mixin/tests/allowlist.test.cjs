'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadAllowlist } = require('../allowlist.cjs');

test('committed client-mixin allow-list is exact and reasoned', () => {
  const data = loadAllowlist(path.join(__dirname, '../allowlist.json'));
  assert.equal(data.missingTargets.length, 14);
  assert.equal(data.unhandled.length, 6);
  assert.ok(data.missingTargets.every(entry => !/railways/.test(entry.mod + entry.config + entry.mixin)));
});
