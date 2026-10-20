'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { watchdog, cpuGrew, cpuPerWall, isStarved } = require('../watchdog.cjs');

const cfg = { silentMs: 180000, hardCapMs: 1800000 };

test('log silent but CPU still growing keeps running', () => {
  assert.strictEqual(watchdog({ wallMs: 400000, sinceLogMs: 300000, sinceCpuMs: 5000 }, cfg), 'ok');
});

test('CPU flat but log still moving keeps running', () => {
  assert.strictEqual(watchdog({ wallMs: 400000, sinceLogMs: 2000, sinceCpuMs: 300000 }, cfg), 'ok');
});

test('log silent AND CPU flat for the window stops', () => {
  assert.strictEqual(watchdog({ wallMs: 400000, sinceLogMs: 180000, sinceCpuMs: 200000 }, cfg), 'silent');
});

test('the hard cap stops even a busy boot', () => {
  assert.strictEqual(watchdog({ wallMs: 1800000, sinceLogMs: 0, sinceCpuMs: 0 }, cfg), 'hardcap');
});

test('cpuGrew needs a real delta; the first sample counts', () => {
  assert.strictEqual(cpuGrew(null, 0.1), true);
  assert.strictEqual(cpuGrew(10, 10.2), false);
  assert.strictEqual(cpuGrew(10, 11), true);
  assert.strictEqual(cpuGrew(10, null), false);
});

test('starvation is CPU per wall second under the threshold', () => {
  assert.strictEqual(cpuPerWall(null, 10), null);
  assert.strictEqual(cpuPerWall(5, 0), null);
  assert.strictEqual(isStarved(10, 900), true);
  assert.strictEqual(isStarved(1500, 900), false);
  assert.strictEqual(isStarved(null, 900), false);
});
