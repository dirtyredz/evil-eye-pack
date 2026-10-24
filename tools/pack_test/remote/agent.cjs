'use strict';
// Runs ON ANU, started detached by remote/anu.cjs (Win32_Process.Create, so it outlives the SSH session).
// Usage: node agent.cjs <runDir>\job.json
// Holds the heartbeat lock the launcher took, boots the run server once through the same execute() as a
// local run, writes status.json (running -> done|error) and agent.log, then releases the lock.
const fs = require('node:fs');
const path = require('node:path');

const jobFile = process.argv[2];
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const runDir = path.dirname(jobFile);
const logFile = fs.createWriteStream(path.join(runDir, 'agent.log'), { flags: 'a' });
const log = (m) => logFile.write(`[${new Date().toISOString()}] ${m}\n`);
const status = (s) => fs.writeFileSync(path.join(runDir, 'status.json'), JSON.stringify({ ...s, pid: process.pid, at: Date.now() }));

// env.cjs reads these when first required, so they are set before anything loads it.
process.env.SMOKE_JAVA = job.java;
process.env.SMOKE_JCMD = job.jcmd;
process.env.SMOKE_ARTIFACTS = job.root;

const procs = require('../../server_smoke/procs.cjs');
const { execute } = require('../session/execute.cjs');
const { startLease } = require('./lease/lifecycle.cjs');

async function main() {
  status({ state: 'running' });
  const scope = procs.scope();
  let lease;
  try {
    lease = startLease({ job, scope, status, log });
    const r = await execute({ ...job, runDir, scope }, log);
    status({ state: 'done', boot: r.boot, world: r.world, timings: r.timings });
    log('done');
  } catch (e) {
    process.exitCode = 2;
    log(`FAILED: ${e.stack || e.message}`);
    status({ state: 'error', error: e.message });
  } finally {
    scope.killAll();
    lease?.close();
    logFile.end();
  }
}

main();
