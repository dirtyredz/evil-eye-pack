'use strict';
// Shared-ANU decision (lock present/absent x RAM x CPU) with stubbed probe readings, the read-only probe
// script, the mode label and the starvation note.
const test = require('node:test');
const assert = require('node:assert/strict');
const { decide, parseProbe, probeScript } = require('../../remote/capacity.cjs');
const { anuBoot } = require('../../remote/anu.cjs');
const { launchScript } = require('../../remote/scripts.cjs');
const { modeLabel, starvedBoot, starvedText } = require('../../verdict/mode.cjs');

const THR = { minFreeGb: 8, maxCpuPct: 50 };
const NEIGH = { lock: 'G:\\mods-ci\\lock', job: 'HerbalWitch-m12', pid: 9004, queued: 3 };
const reading = (o = {}) => ({ neighbours: [NEIGH], freeGb: 20, cpu: [20, 25, 30], ...o });

test('no neighbour lock: run alone whatever the load', () => {
  for (const r of [{ freeGb: 2, cpu: [99, 99] }, { freeGb: 30, cpu: [1] }]) {
    const d = decide(reading({ neighbours: [], ...r }), THR);
    assert.equal(d.mode, 'alone');
    assert.equal(d.neighbour, null);
  }
});

test('neighbour lock held: share only with >= 8 GB free AND mean CPU < 50%', () => {
  const d = decide(reading(), THR);
  assert.equal(d.mode, 'shared');
  assert.equal(d.neighbour, 'HerbalWitch-m12');
  assert.equal(decide(reading({ freeGb: 8 }), THR).mode, 'shared', '8 GB exactly is enough');
  const lowRam = decide(reading({ freeGb: 7.9 }), THR);
  assert.equal(lowRam.mode, 'fallback');
  assert.match(lowRam.reason, /HerbalWitch-m12.*7\.9 GB RAM is free/);
  const busyCpu = decide(reading({ cpu: [60, 70, 40] }), THR); // mean 56.7
  assert.equal(busyCpu.mode, 'fallback');
  assert.match(busyCpu.reason, /CPU is 57% busy/);
  assert.equal(decide(reading({ cpu: [50] }), THR).mode, 'fallback', 'limit is exclusive');
  assert.equal(decide(reading({ freeGb: 2, cpu: [90] }), THR).mode, 'fallback');
});

test('one spiky CPU reading does not decide: the mean of the samples does', () => {
  assert.equal(decide(reading({ cpu: [10, 100, 10, 10, 10] }), THR).mode, 'shared');
  assert.equal(decide(reading({ cpu: [90, 10, 90, 90, 90] }), THR).mode, 'fallback');
});

test('unreadable probe or missing numbers fall back, but only when a neighbour is running', () => {
  assert.equal(decide(null, THR).mode, 'fallback');
  assert.equal(decide(reading({ freeGb: undefined }), THR).mode, 'fallback');
  assert.equal(decide(reading({ cpu: [] }), THR).mode, 'fallback');
  assert.equal(decide(reading({ neighbours: [], cpu: [] }), THR).mode, 'alone');
});

test('thresholds come from the remote config by default and can be overridden per call', () => {
  const cfg = require('../../remote/config.cjs');
  assert.equal(cfg.MIN_FREE_GB, 8);
  assert.equal(cfg.MAX_CPU_PCT, 50);
  assert.equal(decide(reading({ freeGb: 12 }), { minFreeGb: 16, maxCpuPct: 50 }).mode, 'fallback');
  assert.equal(decide(reading({ cpu: [70] }), { minFreeGb: 8, maxCpuPct: 80 }).mode, 'shared');
});

test('parseProbe reads the PROBE line and un-unwraps one-element arrays', () => {
  const out = 'noise\nPROBE {"neighbours":{"lock":"L","job":"j","pid":1,"queued":0},"freeGb":12.5,"cpu":33}\n';
  assert.deepEqual(parseProbe(out), { neighbours: [{ lock: 'L', job: 'j', pid: 1, queued: 0 }], freeGb: 12.5, cpu: [33] });
  assert.equal(parseProbe('nothing'), null);
});

test('the probe only reads a neighbour: no write, delete or lock-taking command touches it', () => {
  const s = probeScript();
  assert.match(s, /G:\\mods-ci\\lock/);
  assert.match(s, /Get-Content/);
  assert.doesNotMatch(s, /Remove-Item|Set-Content|New-Item|Out-File|Stop-Process|Rename-Item|Move-Item|Add-Content/);
});

test('on ANU the server always runs at BelowNormal, whatever the local priority; the agent launches at BelowNormal', () => {
  assert.equal(anuBoot({ priority: 'AboveNormal', timeout: 1 }).priority, 'BelowNormal');
  assert.equal(anuBoot({ priority: 'AboveNormal', timeout: 1 }).timeout, 1);
  assert.match(launchScript('x.json'), /PriorityClass = \[uint32\]16384/); // BELOW_NORMAL_PRIORITY_CLASS
});

test('mode labels: anu (alone), anu (shared with <job>), local (fallback: <reason>)', () => {
  assert.equal(modeLabel({ target: 'anu', shared: null }), 'anu (alone)');
  assert.equal(modeLabel({ target: 'anu', shared: { job: 'HerbalWitch-m12' } }), 'anu (shared with HerbalWitch-m12)');
  assert.equal(modeLabel({ target: 'local', fallback: 'ANU unreachable over SSH' }), 'local (fallback: ANU unreachable over SSH)');
  assert.equal(modeLabel({ target: 'local', fallback: null }), 'local (--local)');
});

test('a boot that never finished with almost no JVM CPU is starved and names the neighbour', () => {
  const boot = { completed: false, crashed: false, cpuSeconds: 30, totalWallSeconds: 600 };
  assert.ok(starvedBoot(boot));
  assert.match(starvedText(boot, { job: 'HerbalWitch-m12' }), /HOST STARVED.*sharing ANU with HerbalWitch-m12.*not a pack failure/);
  assert.ok(!starvedBoot({ ...boot, completed: true }), 'a finished probe is never starved');
  assert.ok(!starvedBoot({ ...boot, crashed: true }), 'a crash is a pack failure');
  assert.ok(!starvedBoot({ ...boot, cpuSeconds: 500 }), 'a busy JVM is not starved');
  assert.ok(!starvedBoot(null));
});
