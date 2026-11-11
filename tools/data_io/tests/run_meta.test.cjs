'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkDestination } = require('../run_meta.cjs');
test('writable run folders must be under the artifacts root and outside every checkout', () => {
  const artifacts = 'C:/a/artifacts';
  assert.doesNotThrow(() => checkDestination('C:/a/artifacts/pack-test/runs/r1', { artifacts, checkouts: ['C:/a/repo'] }));
  assert.throws(() => checkDestination('C:/a/elsewhere/r1', { artifacts, checkouts: [] }), /outside the artifacts root/);
  assert.throws(() => checkDestination('C:/a/artifacts/repo/r1', { artifacts, checkouts: ['C:/a/artifacts/repo'] }), /inside a checkout/);
});
