'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decide, parseCrashCauses } = require('../verdict.cjs');

const clean = { doneSeconds: 40, loadingFailed: false, known: [], fresh: [] };
const noDone = { ...clean, doneSeconds: null };

test('Done with no new errors and no crash is PASS', () => {
  const v = decide({ rep: clean, crashCount: 0, boot: { wallSeconds: 55 }, timeout: 600 });
  assert.strictEqual(v.pass, true);
  assert.match(v.doneText, /^40s \(server\) \/ 55s \(wall/);
});

test('re-analysing a run (no boot result) can PASS', () => {
  assert.strictEqual(decide({ rep: clean, crashCount: 0, boot: null, timeout: 600 }).pass, true);
});

test('a crash report is FAIL and the mod is named', () => {
  const text = ['-- MOD oculus --', 'Details:', '\tFailure message: Oculus (oculus) has failed to load correctly', '\t\tjava.lang.RuntimeException: bad dist'].join('\n');
  assert.deepStrictEqual(parseCrashCauses(text), ['oculus: Failure message: Oculus (oculus) has failed to load correctly | java.lang.RuntimeException: bad dist']);
  const v = decide({ rep: { ...noDone, loadingFailed: true }, crashCount: 1, boot: { crashed: true, timedOut: false, earlyExit: null }, timeout: 600 });
  assert.strictEqual(v.pass, false);
  assert.match(v.doneText, /crash report written/);
});

test('a timeout is FAIL', () => {
  const v = decide({ rep: noDone, crashCount: 0, boot: { crashed: false, timedOut: true, earlyExit: null }, timeout: 600 });
  assert.strictEqual(v.pass, false);
  assert.strictEqual(v.doneText, 'not reached (timeout 600s)');
});

test('new error groups are FAIL even when Done was reached', () => {
  const rep = { ...clean, fresh: [{ signature: 'x', sample: 'x', count: 1 }] };
  assert.strictEqual(decide({ rep, crashCount: 0, boot: null, timeout: 600 }).pass, false);
});

test('early server exit reports its code', () => {
  const v = decide({ rep: noDone, crashCount: 0, boot: { crashed: false, timedOut: false, earlyExit: 3 }, timeout: 600 });
  assert.strictEqual(v.doneText, 'not reached (server exited 3)');
});

test('a timeout inside Preparing spawn area with no errors is a worldgen stall, naming the seed', () => {
  const rep = { ...noDone, spawnPercent: 26 };
  const v = decide({ rep, crashCount: 0, boot: { crashed: false, timedOut: true, earlyExit: null }, timeout: 600, seed: '42' });
  assert.strictEqual(v.pass, false);
  assert.strictEqual(v.stall, true);
  assert.match(v.doneText, /WORLDGEN STALL at "Preparing spawn area" 26%, seed 42/);
});

test('a timeout with new errors, a crash, or before spawn prep is not a stall', () => {
  const t = { crashed: false, timedOut: true, earlyExit: null };
  const err = { ...noDone, spawnPercent: 26, fresh: [{ signature: 'x', count: 1 }] };
  assert.strictEqual(decide({ rep: err, crashCount: 0, boot: t, timeout: 600, seed: '42' }).stall, false);
  assert.strictEqual(decide({ rep: { ...noDone, spawnPercent: 26 }, crashCount: 1, boot: t, timeout: 600, seed: '42' }).stall, false);
  const early = decide({ rep: { ...noDone, spawnPercent: null }, crashCount: 0, boot: t, timeout: 600, seed: '42' });
  assert.strictEqual(early.stall, false);
  assert.match(early.doneText, /\(seed 42\)$/);
});
