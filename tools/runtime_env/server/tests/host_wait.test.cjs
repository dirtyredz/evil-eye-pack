'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { waitForServer } = require('../host_wait.cjs');

test('host guard waits through busy and inconclusive process inventories; only an observed idle host passes', async () => {
  let now = 0, calls = 0;
  const responses = [{ code: 0, out: 'another JVM' }, { code: -1, out: 'timed out' }, { code: 0, out: '' }];
  await waitForServer({ run: async () => { calls++; return responses.shift(); } }, { now: () => now, wait: async n => { now += n; }, log: () => {} });
  assert.equal(calls, 3); assert.equal(now, 120000);
});

test('host guard fails closed after its bounded wait or cancellation', async () => {
  let now = 0;
  await assert.rejects(waitForServer({ run: async () => ({ code: -1, out: 'unavailable' }) }, { now: () => now, wait: async n => { now += n; }, log: () => {}, budgetMs: 60000 }), /Host unavailable/);
  await assert.rejects(waitForServer({ cancelled: true }), /Interrupted/);
});
