'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { inventory } = require('../offline.cjs');
const { sections, logGroups, waitForServer } = require('../check.cjs');

test('every shipped section has a committed headless check', () => {
  assert.ok(sections(path.resolve(__dirname, '../../..')).includes('contraption_storage'));
});
test('offline inventory verifies server pins and never needs client-only jars', t => {
  const root = fs.mkdtempSync(path.join(__dirname, 'showcase-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cache = path.join(root, 'cache'); fs.mkdirSync(path.join(root, 'mods')); fs.mkdirSync(path.join(cache, 'mods'), { recursive: true });
  const bytes = Buffer.from('fixture'), hash = crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(root, 'index.toml'), 'hash-format = "sha256"\n' + ['server', 'client'].map(n => '\n[[files]]\nfile = "mods/' + n + '.pw.toml"\nhash = "unused"\nmetafile = true\n').join(''));
  for (const n of ['server', 'client']) fs.writeFileSync(path.join(root, 'mods', n + '.pw.toml'), 'name = "fixture"\nfilename = "' + n + '.jar"\nside = "' + (n === 'client' ? 'client' : 'both') + '"\n[download]\nhash-format = "sha256"\nhash = "' + hash + '"\nurl = "https://invalid.test/never-downloaded"\n');
  assert.throws(() => inventory(root, cache), /Missing offline input/);
  fs.writeFileSync(path.join(cache, 'mods/server.jar'), bytes);
  assert.equal(inventory(root, cache).length, 1);
  fs.writeFileSync(path.join(cache, 'mods/server.jar'), 'wrong');
  assert.throws(() => inventory(root, cache), /differs from pin/);
});
test('warning/error comparison ignores timestamps but retains new script failures', () => {
  const a = logGroups('[12:00:00] [main/WARN] known\n[12:00:01] [main/INFO] harmless');
  const b = logGroups('[13:00:00] [main/WARN] known\n[13:00:01] [Server thread/ERROR] showcase/command.js: failed');
  assert.equal(Object.keys(a).length, 1);
  assert.equal(Object.keys(b).filter(k => !a[k]).length, 1);
});

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
