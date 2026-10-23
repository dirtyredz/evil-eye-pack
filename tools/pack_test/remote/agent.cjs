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
const { refreshDirLock, releaseDirLock } = require('./dir_lock.cjs');

async function main() {
  status({ state: 'running' });
  const scope = procs.scope();
  const heartbeat = setInterval(() => { try { refreshDirLock(job.lock, job.runId); } catch (e) { log(`lock refresh failed: ${e.message}`); } }, 30000);
  const stop = () => { log('terminated; killing children'); scope.killAll(); status({ state: 'error', error: 'agent terminated' }); releaseDirLock(job.lock, job.runId); process.exit(2); };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    refreshDirLock(job.lock, job.runId);
    const r = await execute({ ...job, runDir, scope }, log);
    status({ state: 'done', boot: r.boot, world: r.world, timings: r.timings });
    log('done');
  } catch (e) {
    log(`FAILED: ${e.stack || e.message}`);
    status({ state: 'error', error: e.message });
  } finally {
    clearInterval(heartbeat);
    scope.killAll();
    releaseDirLock(job.lock, job.runId);
    logFile.end();
  }
}

main();
