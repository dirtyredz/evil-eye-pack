'use strict';
// Select the target, fall back locally, and retry a starved shared ANU run exactly once.
const fs = require('node:fs');
const path = require('node:path');
const { execute } = require('./execute.cjs');
const { runOnAnu } = require('../remote/anu.cjs');
const { starvedBoot, starvedText } = require('../verdict/mode.cjs');

async function runTarget({ options: o, stageDir, runDir, run, worldCache, java, jcmd, scope, onAbort, onSynced }, log, { executeImpl = execute, runOnAnuImpl = runOnAnu } = {}) {
  const bootOpts = { priority: o.priority, sample: o.sample, silent: o.silent, timeout: o.timeout, probeTimeout: o.probeTimeout };
  const runLocal = async () => {
    const r = await executeImpl({ stageDir, runDir, worldCache, input: run.input, seed: o.seed, port: o.port, heap: o.heap, boot: bootOpts, freshWorld: o.freshWorld, keepServer: o.keepServer, java, jcmd, scope }, log);
    Object.assign(run, { target: 'local', boot: r.boot, world: r.world });
    Object.assign(run.timings, r.timings);
  };
  let remote = null;
  if (!o.local) {
    run.target = 'anu';
    remote = await runOnAnuImpl({ stageDir, runDir, input: run.input, seed: o.seed, port: o.port, heap: o.heap, boot: bootOpts, freshWorld: o.freshWorld, scope, log, onAbort, onSynced });
    if (remote.fallback) { run.fallback = remote.fallback; run.target = 'local'; log(`ANU not used: ${remote.fallback}; running on this machine`); }
  }
  if (remote && !remote.fallback) {
    Object.assign(run, { target: 'anu', boot: remote.boot, world: remote.world, shared: remote.shared });
    Object.assign(run.timings, remote.timings);
    // Starved beside a neighbour: not a pack result. One automatic re-run here, then the analysis reports it.
    if (remote.shared && starvedBoot(remote.boot)) {
      const text = `${starvedText(remote.boot, remote.shared)}; re-ran once on this machine`;
      log(text);
      run.sharedAttempt = { text, job: remote.shared.job, boot: remote.boot };
      run.fallback = `shared ANU run beside ${remote.shared.job} was CPU-starved`;
      run.target = 'local'; run.shared = null;
      for (const d of ['probe', 'logs', 'crash-reports']) fs.rmSync(path.join(runDir, 'evidence', d), { recursive: true, force: true });
      await runLocal();
    }
  } else {
    await runLocal();
  }
}

module.exports = { runTarget };
