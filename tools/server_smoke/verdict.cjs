'use strict';
// PASS/FAIL decision and crash-report parsing for the server smoke. No process handling.
const fs = require('node:fs');
const path = require('node:path');

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
// boot: result of boot(), or null when re-analysing a finished run.
function decide({ rep, crashCount, boot, timeout }) {
  const pass = rep.doneSeconds !== null && !crashCount && !rep.loadingFailed && !rep.fresh.length;
  let doneText = 'not reached';
  if (rep.doneSeconds !== null) {
    doneText = `${rep.doneSeconds}s (server)${boot && boot.wallSeconds ? ` / ${boot.wallSeconds}s (wall, JVM start to Done)` : ''}`;
  } else if (boot && boot.crashed) doneText = 'not reached (crash report written; JVM was still alive)';
  else if (boot && boot.timedOut) doneText = `not reached (timeout ${timeout}s)`;
  else if (boot && boot.earlyExit !== null) doneText = `not reached (server exited ${boot.earlyExit})`;
  return { pass, doneText };
}

module.exports = { crashReports, crashCauses, parseCrashCauses, decide };
