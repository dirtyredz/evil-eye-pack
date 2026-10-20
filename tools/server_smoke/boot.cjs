'use strict';
// Boots the prepared server dir hidden, waits for Done or a crash, then stop (kill the tree if it will not).
const fs = require('node:fs');
const path = require('node:path');
const procs = require('./procs.cjs');
const { JAVA, JCMD, FORGE } = require('./env.cjs');
const { DONE_RE } = require('./log_report.cjs');
const { watchdog, cpuGrew } = require('./watchdog.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Before the timeout kill, save a jcmd thread dump so a stall can be pinned to the stuck thread.
async function threadDump(pid, runDir, log) {
  const r = await procs.run(JCMD, [String(pid), 'Thread.print'], { cwd: runDir });
  fs.writeFileSync(path.join(runDir, 'stall-threads.txt'), r.out);
  log(`stall: thread dump saved to ${path.join(runDir, 'stall-threads.txt')} (jcmd exit ${r.code})`);
}

async function boot(runDir, o, log) {
  const argsFile = `libraries/net/minecraftforge/forge/${FORGE}/win_args.txt`;
  const p = procs.start(JAVA, ['@user_jvm_args.txt', `@${argsFile}`, 'nogui'], { cwd: runDir, stdio: ['pipe', 'pipe', 'pipe'] });
  const out = fs.createWriteStream(path.join(runDir, 'console.log'));
  let doneAt = null;
  let crashedAt = null;
  let exited = null;
  const t0 = Date.now();
  let lastLogAt = t0;
  let lastCpuAt = t0;
  const onData = (d) => {
    out.write(d);
    lastLogAt = Date.now();
    if (doneAt === null && DONE_RE.test(d.toString())) doneAt = Date.now();
  };
  p.stdout.on('data', onData);
  p.stderr.on('data', onData);
  p.on('exit', (c) => { exited = c === null ? -1 : c; });
  p.stdin.on('error', () => {});
  const pr = await procs.setPriority(p.pid, o.priority);
  log(pr.skipped ? 'priority: left unchanged' : `priority ${o.priority} on pid ${p.pid}: ${pr.ok ? 'ok' : `FAILED (${pr.out})`}`);
  const crashDir = path.join(runDir, 'crash-reports');
  let cpu = null;
  let sampling = false;
  let stopReason = null;
  let nextSample = Date.now() + o.sample * 1000;
  const sampleCpu = async () => {
    sampling = true;
    const c = await procs.cpuSeconds(p.pid);
    if (c !== null) { if (cpuGrew(cpu, c)) lastCpuAt = Date.now(); cpu = c; }
    sampling = false;
  };
  while (doneAt === null && exited === null && !(crashedAt && Date.now() - crashedAt > 3000)) {
    if (crashedAt === null && fs.existsSync(crashDir) && fs.readdirSync(crashDir).length) crashedAt = Date.now();
    if (Date.now() >= nextSample && !sampling) { nextSample = Date.now() + o.sample * 1000; sampleCpu(); }
    const now = Date.now();
    stopReason = watchdog({ wallMs: now - t0, sinceLogMs: now - lastLogAt, sinceCpuMs: now - lastCpuAt }, { silentMs: o.silent * 1000, hardCapMs: o.timeout * 1000 });
    if (stopReason !== 'ok') break;
    await sleep(500);
  }
  while (sampling) await sleep(50);
  const timedOut = doneAt === null && exited === null && crashedAt === null && stopReason !== null && stopReason !== 'ok';
  if (doneAt !== null && exited === null) {
    log('Done reached; sending stop');
    p.stdin.write('stop\n');
    const stopBy = Date.now() + 60000;
    while (exited === null && Date.now() < stopBy) await sleep(500);
  }
  if (exited === null) {
    log(timedOut ? `${stopReason === 'silent' ? `no log output and no JVM CPU growth for ${o.silent}s` : `hard cap ${o.timeout}s`}; killing process tree` : crashedAt ? 'crash report written; killing process tree' : 'stop did not finish; killing process tree');
    if (timedOut) { await sampleCpu(); await threadDump(p.pid, runDir, log); }
    procs.killTree(p.pid);
    await sleep(1500);
  }
  out.end();
  const totalWall = (Date.now() - t0) / 1000;
  return { wallSeconds: doneAt ? (doneAt - t0) / 1000 : null, totalWallSeconds: totalWall, cpuSeconds: cpu, stopReason, timedOut, crashed: crashedAt !== null, earlyExit: !timedOut && doneAt === null ? exited : null };
}

module.exports = { boot };
