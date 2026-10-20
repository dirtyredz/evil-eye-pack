'use strict';
// PASS/STALL/HOST STARVED/FAIL decision and crash-report parsing for the server smoke. No process handling.
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

// The verdict kinds: the kind is the printed header label; the value is the process exit code.
const EXIT_CODES = { PASS: 0, STALL: 3, 'HOST STARVED': 4, FAIL: 1 };

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
  // A timeout with no crash, no loading failure and no new errors is not the pack's fault: worldgen or the host.
  const unexplainedTimeout = !pass && rep.doneSeconds === null && !crashCount && !rep.loadingFailed && !rep.fresh.length && !!boot && boot.timedOut;
  // A silent/timed-out boot where the JVM got almost no CPU is the host's fault; inside "Preparing spawn area" otherwise, worldgen.
  let kind = 'FAIL';
  if (pass) kind = 'PASS';
  else if (unexplainedTimeout && isStarved(boot.cpuSeconds, boot.totalWallSeconds, starvedCores)) kind = 'HOST STARVED';
  else if (unexplainedTimeout && rep.spawnPercent != null) kind = 'STALL';
  if (kind === 'HOST STARVED') doneText += ` HOST STARVED: JVM used ${boot.cpuSeconds.toFixed(1)} CPU s in ${Math.round(boot.totalWallSeconds)} s wall (${(boot.cpuSeconds / boot.totalWallSeconds).toFixed(2)} cores); not a pack failure, retry when the host is idle`;
  else if (kind === 'STALL') doneText += ` WORLDGEN STALL at "Preparing spawn area" ${rep.spawnPercent}%, seed ${seed}; not a pack failure, retry with another --seed`;
  else if (kind === 'FAIL' && seed !== undefined) doneText += ` (seed ${seed})`;
  return { kind, doneText };
}

module.exports = { crashReports, crashCauses, parseCrashCauses, decide, EXIT_CODES };
