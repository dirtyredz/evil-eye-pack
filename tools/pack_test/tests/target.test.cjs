'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runTarget } = require('../session/target.cjs');

const starved = { completed: false, timedOut: true, totalWallSeconds: 100, cpuSeconds: 1 };

for (const scenario of [
  { name: 'explicit local', local: true, remote: null, calls: ['local'], target: 'local' },
  { name: 'ANU fallback', remote: { fallback: 'busy' }, calls: ['anu', 'local'], target: 'local' },
  { name: 'ANU alone', remote: { boot: { completed: true }, shared: null }, calls: ['anu'], target: 'anu' },
  { name: 'ANU shared', remote: { boot: { completed: true }, shared: { job: 'other' } }, calls: ['anu'], target: 'anu' },
  { name: 'ANU alone starved', remote: { boot: starved, shared: null }, calls: ['anu'], target: 'anu' },
  { name: 'ANU shared starved', remote: { boot: starved, shared: { job: 'other' } }, calls: ['anu', 'local'], target: 'local', retry: true }
]) {
  test(`target sequencing: ${scenario.name}`, async () => {
    const runDir = fs.mkdtempSync(path.join(__dirname, '.target-test-'));
    const calls = [];
    const run = { input: { token: 't' }, timings: { stage: 1 } };
    const onAbort = () => {}, onSynced = () => {};
    try {
      for (const name of ['probe', 'logs', 'crash-reports', 'pack-config']) {
        fs.mkdirSync(path.join(runDir, 'evidence', name), { recursive: true });
        fs.writeFileSync(path.join(runDir, 'evidence', name, 'old'), 'old');
      }
      fs.writeFileSync(path.join(runDir, 'evidence/resources.json'), '{}');
      await runTarget({ options: { local: scenario.local, seed: '1', priority: 'AboveNormal', keepServer: true }, stageDir: 'stage', runDir, run, worldCache: 'worlds', scope: {}, onAbort, onSynced }, () => {}, {
        runOnAnuImpl: async (o) => {
          calls.push('anu');
          assert.equal(o.input, run.input);
          assert.equal(o.onAbort, onAbort);
          assert.equal(o.onSynced, onSynced);
          return { world: { reused: true }, timings: { remote: 2 }, ...scenario.remote };
        },
        executeImpl: async (o) => {
          calls.push('local');
          assert.equal(o.worldCache, 'worlds');
          assert.equal(o.keepServer, true);
          assert.equal(o.boot.priority, 'AboveNormal');
          for (const name of ['probe', 'logs', 'crash-reports']) {
            assert.equal(fs.existsSync(path.join(runDir, 'evidence', name, 'old')), !scenario.retry);
          }
          assert.ok(fs.existsSync(path.join(runDir, 'evidence/pack-config/old')));
          assert.ok(fs.existsSync(path.join(runDir, 'evidence/resources.json')));
          // A starved local retry is still terminal: it must never trigger another boot.
          return { boot: starved, world: { saved: true }, timings: { boot: 3 } };
        }
      });
      assert.deepEqual(calls, scenario.calls);
      assert.equal(run.target, scenario.target);
      assert.equal(run.timings.stage, 1);
      if (scenario.retry) {
        assert.equal(run.shared, null);
        assert.equal(run.sharedAttempt.job, 'other');
        assert.equal(run.sharedAttempt.boot, starved);
        assert.match(run.fallback, /CPU-starved/);
        assert.equal(run.timings.remote, 2);
      } else if (scenario.remote?.fallback) assert.equal(run.fallback, 'busy');
    } finally { fs.rmSync(runDir, { recursive: true, force: true }); }
  });
}

test('a remote execution failure propagates without silently booting locally', async () => {
  let localCalls = 0;
  await assert.rejects(runTarget({ options: {}, run: { timings: {} } }, () => {}, {
    runOnAnuImpl: async () => { throw new Error('agent failed'); },
    executeImpl: async () => { localCalls++; }
  }), /agent failed/);
  assert.equal(localCalls, 0);
});
