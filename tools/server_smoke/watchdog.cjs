'use strict';
// Pure progress-watchdog decisions for the server smoke. No process or file handling.

// Stop only when the log is silent AND JVM CPU is flat for silentMs; hardCapMs is the absolute limit.
// st: { wallMs, sinceLogMs, sinceCpuMs } (ms since boot / last new log bytes / last CPU growth).
function watchdog(st, { silentMs, hardCapMs }) {
  if (st.wallMs >= hardCapMs) return 'hardcap';
  if (st.sinceLogMs >= silentMs && st.sinceCpuMs >= silentMs) return 'silent';
  return 'ok';
}

// CPU counts as growth when a sample is at least minDelta seconds above the previous one.
const cpuGrew = (prev, cur, minDelta = 0.5) => prev === null || (cur !== null && cur - prev >= minDelta);

// Average cores used over the run; null when it cannot be computed.
const cpuPerWall = (cpuSeconds, wallSeconds) =>
  cpuSeconds === null || cpuSeconds === undefined || !(wallSeconds > 0) ? null : cpuSeconds / wallSeconds;

// Starved: the JVM got well under starvedCores of CPU per wall second across a run that did not finish.
const isStarved = (cpuSeconds, wallSeconds, starvedCores = 0.25) => {
  const r = cpuPerWall(cpuSeconds, wallSeconds);
  return r !== null && r < starvedCores;
};

module.exports = { watchdog, cpuGrew, cpuPerWall, isStarved };
