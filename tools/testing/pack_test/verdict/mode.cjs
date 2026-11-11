'use strict';
// Which machine and mode a run used, and whether a boot that did not finish was CPU-starved.
const { isStarved } = require('../../../runtime_env/server/watchdog.cjs');

// run: { target, fallback, shared, local }. One of: anu (alone), anu (shared with <job>),
// local (fallback: <reason>), local (--local), or not started (setup failed first).
function modeLabel(run) {
  if (run.target === 'anu') return run.shared ? `anu (shared with ${run.shared.job})` : 'anu (alone)';
  if (run.target === 'none') return 'not started (setup failed before a target was chosen)';
  return run.fallback ? `local (fallback: ${run.fallback})` : 'local (--local)';
}

// A boot that never finished, with no crash, where the JVM averaged under the starvation floor.
// Same rule as the server smoke's HOST STARVED, so it is never mistaken for a pack failure.
function starvedBoot(boot) {
  return !!boot && boot.completed !== true && !boot.crashed && isStarved(boot.cpuSeconds, boot.totalWallSeconds);
}

function starvedText(boot, shared) {
  const cores = (boot.cpuSeconds / boot.totalWallSeconds).toFixed(2);
  const where = shared ? `while sharing ANU with ${shared.job}` : 'on a busy host';
  return `HOST STARVED: the JVM got ${boot.cpuSeconds.toFixed(1)} CPU s in ${Math.round(boot.totalWallSeconds)} s wall (${cores} cores) ${where}; not a pack failure, retry when the host is idle`;
}

module.exports = { modeLabel, starvedBoot, starvedText };
