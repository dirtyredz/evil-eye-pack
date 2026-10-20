'use strict';
// PASS/FAIL decision and crash-report parsing for the server smoke. No process handling.
const fs = require('node:fs');
const path = require('node:path');
const { isStarved } = require('./watchdog.cjs');

function crashReports(runDir) {
  const d = path.join(runDir, 'crash-reports');
  return fs.existsSync(d) ? fs.readdirSync(d).map((f) => path.join(d, f)) : [];
}

// Forge writes only the first failing mod; pull mod name, file and message from the crash report text.
function parseCrashCauses(text) {
  const lines = text.split(/\r?\n/);
  const causes = [];
  lines.forEach((l, i) => {
    const mod = /^-- MOD (\S+) --/.exec(l);
    if (mod) {
      const at = lines.findIndex((x, j) => j > i && /Failure message/.test(x));
      causes.push(at < 0 ? mod[1] : `${mod[1]}: ${lines[at].trim()} | ${(lines[at + 1] || '').trim()}`);
    }
  });
  return causes;
}

const crashCauses = (file) => parseCrashCauses(fs.readFileSync(file, 'utf8'));

// rep: log_report.analyze result; crashCount: crash reports on disk;
// boot: result of boot(), or null when re-analysing a finished run. seed: the run's level-seed.
function decide({ rep, crashCount, boot, timeout, seed, starvedCores }) {
  const pass = rep.doneSeconds !== null && !crashCount && !rep.loadingFailed && !rep.fresh.length;
  let doneText = 'not reached';
  if (rep.doneSeconds !== null) {
    doneText = `${rep.doneSeconds}s (server)${boot && boot.wallSeconds ? ` / ${boot.wallSeconds}s (wall, JVM start to Done)` : ''}`;
  } else if (boot && boot.crashed) doneText = 'not reached (crash report written; JVM was still alive)';
  else if (boot && boot.timedOut) doneText = boot.stopReason === 'silent' ? 'not reached (log silent and JVM CPU flat)' : `not reached (timeout ${timeout}s)`;
  else if (boot && boot.earlyExit !== null) doneText = `not reached (server exited ${boot.earlyExit})`;
  // A timeout inside "Preparing spawn area" with no crash and no new errors is worldgen, not the pack.
  const stallRaw = !pass && rep.doneSeconds === null && rep.spawnPercent != null && !crashCount
    && !rep.loadingFailed && !rep.fresh.length && !!boot && boot.timedOut;
  // A silent/timed-out boot where the JVM got almost no CPU is the host's fault, not the pack's or worldgen's.
  const starved = !pass && rep.doneSeconds === null && !crashCount && !rep.loadingFailed && !rep.fresh.length
    && !!boot && boot.timedOut && isStarved(boot.cpuSeconds, boot.totalWallSeconds, starvedCores);
  const stall = !starved && stallRaw;
  if (starved) doneText += ` HOST STARVED: JVM used ${boot.cpuSeconds.toFixed(1)} CPU s in ${Math.round(boot.totalWallSeconds)} s wall (${(boot.cpuSeconds / boot.totalWallSeconds).toFixed(2)} cores); not a pack failure, retry when the host is idle`;
  else if (stall) doneText += ` WORLDGEN STALL at "Preparing spawn area" ${rep.spawnPercent}%, seed ${seed}; not a pack failure, retry with another --seed`;
  else if (!pass && seed !== undefined) doneText += ` (seed ${seed})`;
  return { pass, stall, starved, doneText };
}

module.exports = { crashReports, crashCauses, parseCrashCauses, decide };
