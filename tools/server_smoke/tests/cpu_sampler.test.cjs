'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cpuSampler } = require('../cpu_sampler.cjs');

function setup(values) {
  const clock = { t: 0 };
  const q = [...values];
  const reads = { n: 0 };
  const readCpu = async () => { reads.n += 1; return q.shift(); };
  const s = cpuSampler(readCpu, 42, { intervalMs: 1000, now: () => clock.t });
  return { clock, reads, s };
}

test('tick does nothing before the interval, then starts one sample', async () => {
  const { clock, reads, s } = setup([1, 2]);
  clock.t = 999;
  assert.equal(s.tick(), false);
  clock.t = 1000;
  assert.equal(s.tick(), true);
  assert.equal(s.tick(), false); // still in flight
  await s.drain();
  assert.equal(reads.n, 1);
  assert.equal(s.tick(), false); // next due at 2000
  clock.t = 2000;
  assert.equal(s.tick(), true);
  await s.drain();
  assert.equal(s.samples, 2);
});

test('lastGrowthAt advances only on a >=0.5 s CPU delta', async () => {
  const { clock, s } = setup([1, 1.3, 2.0]);
  assert.equal(s.lastGrowthAt, 0);
  clock.t = 1000; s.tick(); await s.drain();
  assert.equal(s.lastGrowthAt, 1000); // first reading counts
  clock.t = 2000; s.tick(); await s.drain();
  assert.equal(s.lastGrowthAt, 1000); // +0.3 is not growth
  clock.t = 3000; s.tick(); await s.drain();
  assert.equal(s.lastGrowthAt, 3000); // +0.7 is
  assert.equal(s.cpu, 2.0);
});

test('null readings keep the previous cpu and growth time', async () => {
  const { clock, s } = setup([5, null]);
  clock.t = 1000; s.tick(); await s.drain();
  clock.t = 2000; s.tick(); await s.drain();
  assert.equal(s.cpu, 5);
  assert.equal(s.lastGrowthAt, 1000);
  assert.equal(s.samples, 2);
});

test('final waits for an in-flight sample and takes one more', async () => {
  const clock = { t: 0 };
  const gates = [];
  let reads = 0;
  const readCpu = () => { reads += 1; return new Promise((r) => gates.push(r)); };
  const s = cpuSampler(readCpu, 1, { intervalMs: 1000, now: () => clock.t });
  clock.t = 1000;
  s.tick();
  const fin = s.final();
  await new Promise((r) => setImmediate(r));
  assert.equal(reads, 1); // second read waits for the first
  gates[0](3);
  await new Promise((r) => setImmediate(r));
  assert.equal(reads, 2);
  gates[1](4);
  assert.equal(await fin, 4);
  assert.equal(s.samples, 2);
});
