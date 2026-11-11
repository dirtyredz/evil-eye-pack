'use strict';
// Samples a process's CPU time on an interval, one sample in flight at a time, and remembers when it last grew.
// readCpu(pid) resolves to seconds or null; now() is injectable for tests.
const { cpuGrew } = require('./watchdog.cjs');

function cpuSampler(readCpu, pid, { intervalMs, now = Date.now }) {
  const t0 = now();
  const st = { cpu: null, lastGrowthAt: t0, samples: 0 };
  let nextAt = t0 + intervalMs;
  let inFlight = null;

  async function sample() {
    const c = await readCpu(pid);
    if (c !== null) {
      if (cpuGrew(st.cpu, c)) st.lastGrowthAt = now();
      st.cpu = c;
    }
    st.samples += 1;
  }

  // Starts a sample when one is due and none is running. Never awaits it.
  function tick() {
    if (inFlight || now() < nextAt) return false;
    nextAt = now() + intervalMs;
    inFlight = sample().finally(() => { inFlight = null; });
    return true;
  }

  // Waits for a running sample, then takes one more (the final reading before a verdict).
  async function final() {
    if (inFlight) await inFlight;
    await sample();
    return st.cpu;
  }

  async function drain() { if (inFlight) await inFlight; }

  return { tick, final, drain, get cpu() { return st.cpu; }, get lastGrowthAt() { return st.lastGrowthAt; }, get samples() { return st.samples; } };
}

module.exports = { cpuSampler };
