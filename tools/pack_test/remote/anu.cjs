'use strict';
// The ANU target, driven from Valhalla: connect, provision if needed, take our heartbeat lock (never
// waiting), check ANU has room when a neighbour project's job is running, sync the staged server and
// the tool code, start the agent detached at BelowNormal, poll its status, pull the evidence back into
// the local run folder, clean the remote run. Returns { boot, world, timings, shared } (shared = the
// neighbour job we ran beside, or null) or { fallback: reason } when ANU cannot be used (the caller runs
// locally). Errors after the agent has started are real failures, never silent fallbacks.
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('./config.cjs');
const { connect, q } = require('./ssh.cjs');
const { syncDir } = require('./sync.cjs');
const { ensureProvisioned, javaExe, jcmdExe } = require('./provision.cjs');
const { probeScript, parseProbe, decide } = require('./capacity.cjs');
const { acquire, releaseScript } = require('./dir_lock.cjs');
const { launchScript, statusScript, killScript } = require('./scripts.cjs');
const { pullEvidence } = require('./evidence.cjs');

const TOOLS_DIR = path.resolve(__dirname, '../..');
const CODE_DIRS = ['server_smoke', 'pack_test', 'emi_coverage'];
const STAGE_SKIP = (rel) => /^(smoke-world|logs|crash-reports|pack_test)(\/|$)/.test(rel);

// Reads ANU's load and decides alone / shared / fallback (capacity.cjs).
async function checkCapacity(ssh, log) {
  const r = await ssh.ps(probeScript(), { timeoutMs: 90000 });
  let reading = null;
  try { reading = r.code === 0 ? parseProbe(r.out) : null; } catch { /* unreadable: fall back */ }
  const d = decide(reading);
  log(`ANU capacity: ${d.mode} (${d.reason})`);
  return d;
}

// ANU runs the server at BelowNormal whether alone or beside a neighbour: it must never outrank the
// neighbour's job (the local default, AboveNormal, does not apply here).
const anuBoot = (boot) => ({ ...boot, priority: 'BelowNormal' });

// o: { stageDir, runDir, input, seed, port, heap, boot, freshWorld, scope, log, onAbort, onSynced }
async function runOnAnu(o) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const { scope, log } = o;
  const timings = {};
  let t = Date.now();
  const ssh = await connect(scope);
  if (!ssh) return { fallback: 'ANU unreachable over SSH (anu, anu-byname)' };
  timings.connect = (Date.now() - t) / 1000;
  log(`ANU reachable as ${ssh.host}`);
  await ensureProvisioned(ssh, scope, log);
  const runId = path.basename(o.runDir);
  const lock = await acquire(ssh, runId);
  if (!lock.ok) return { fallback: `${lock.why} holds ANU` };
  const remoteRun = `${cfg.RUNS}\\${runId}`;
  let agentPid = null;
  let disarmAbort = () => {}; // the interrupt kill callback, live only while the agent is running
  try {
    const early = await checkCapacity(ssh, log); // cheap early exit before the sync
    if (early.mode === 'fallback') return { fallback: early.reason };
    t = Date.now();
    const st = await syncDir(ssh, scope, o.stageDir, cfg.STAGE, { incoming: cfg.INCOMING, skip: STAGE_SKIP, log, label: 'stage' });
    for (const d of CODE_DIRS) await syncDir(ssh, scope, path.join(TOOLS_DIR, d), `${cfg.CODE}\\${d}`, { incoming: cfg.INCOMING, skip: (r) => /^tests(\/|$)/.test(r), log, label: `tools-${d}` });
    timings.sync = (Date.now() - t) / 1000;
    if (o.onSynced) o.onSynced(); // the local stage may change again now
    log(`synced stage (${st.changed} changed, ${st.removed} removed, ${(st.bytes / 1048576).toFixed(1)} MiB) in ${Math.round(timings.sync)} s`);
    const verdict = await checkCapacity(ssh, log); // authoritative: just before starting
    if (verdict.mode === 'fallback') return { fallback: verdict.reason };
    const shared = verdict.mode === 'shared' ? { job: verdict.neighbour, freeGb: verdict.freeGb, cpuPct: verdict.cpuPct } : null;
    const job = {
      runId, root: cfg.ROOT, stageDir: cfg.STAGE, worldCache: cfg.WORLDS, lock: cfg.LOCK, input: o.input, seed: o.seed, port: o.port, heap: o.heap,
      boot: anuBoot(o.boot), freshWorld: o.freshWorld, java: javaExe, jcmd: jcmdExe
    };
    const jobLocal = path.join(o.runDir, 'job.json');
    fs.writeFileSync(jobLocal, JSON.stringify(job, null, 1));
    await ssh.must(`New-Item -ItemType Directory -Force ${q(remoteRun)} | Out-Null`);
    const up = await ssh.scpTo(jobLocal, `${remoteRun}\\job.json`);
    if (up.code !== 0) throw new Error(`job upload failed: ${up.out.slice(0, 300)}`);
    const launched = await ssh.must(launchScript(`${remoteRun}\\job.json`));
    agentPid = Number((launched.match(/PID (\d+)/) || [])[1]);
    if (!agentPid) throw new Error(`agent did not start: ${launched.slice(0, 300)}`);
    const killAgent = () => ssh.ps(killScript(agentPid, `${remoteRun}\\job.json`), { timeoutMs: 30000 });
    if (o.onAbort) disarmAbort = o.onAbort(killAgent) || disarmAbort;
    log(`agent started on ANU (pid ${agentPid}); waiting for the boot`);
    t = Date.now();
    const deadline = Date.now() + (o.boot.timeout + o.boot.probeTimeout + 600) * 1000;
    let status = null;
    let misses = 0;
    for (;;) {
      await sleep(o.pollMs || 15000);
      const r = await ssh.ps(statusScript(remoteRun, agentPid), { timeoutMs: 60000 });
      if (r.code !== 0) { if (++misses >= 8) throw new Error(`lost contact with ANU while the run was in progress: ${r.out.slice(0, 200)}`); continue; }
      misses = 0;
      const alive = /ALIVE=True/.test(r.out);
      try { status = JSON.parse(r.out.slice(r.out.indexOf('{'))); } catch { status = {}; }
      if (status.state === 'done' || status.state === 'error') break;
      if (!alive) throw new Error('the ANU agent exited without writing a final status');
      if (Date.now() > deadline) { await killAgent(); throw new Error('the ANU run exceeded its deadline; agent killed'); }
    }
    disarmAbort(); // terminal state: the PID may be reused from here on, so Ctrl+C must not kill it
    timings.remote = (Date.now() - t) / 1000;
    t = Date.now();
    await pullEvidence(ssh, scope, remoteRun, o.runDir);
    timings.pull = (Date.now() - t) / 1000;
    await ssh.ps(`Remove-Item -Recurse -Force ${q(remoteRun)}`, { timeoutMs: 300000 });
    if (status.state === 'error') throw new Error(`ANU agent failed: ${status.error}`);
    return { boot: status.boot, world: status.world, shared, timings: { ...timings, ...Object.fromEntries(Object.entries(status.timings || {}).map(([k, v]) => [`anu_${k}`, v])) } };
  } finally {
    disarmAbort();
    if (!agentPid) await ssh.ps(releaseScript(runId), { timeoutMs: 60000 }); // the agent releases its own lock
  }
}

module.exports = { runOnAnu, anuBoot };
