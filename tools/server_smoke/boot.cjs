'use strict';
// Boot supervisor: spawn the prepared server dir hidden, tee the console, and wait for completion
// (`Done (`, or Done plus the caller's own condition) or a crash, under the progress watchdog. Then stop it.
const fs = require('node:fs');
const path = require('node:path');
const procs = require('./procs.cjs');
const env = require('./env.cjs');
const { DONE_RE } = require('./log_report.cjs');
const { watchdog } = require('./watchdog.cjs');
const { cpuSampler } = require('./cpu_sampler.cjs');
const { threadDump, stopServer, closeStream } = require('./shutdown.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Line-buffered matcher: a marker split across two output chunks is still seen.
function lineWatcher(re) {
  let tail = '';
  return (chunk) => {
    const text = tail + chunk;
    const nl = text.lastIndexOf('\n');
    tail = nl < 0 ? text : text.slice(nl + 1);
    if (tail.length > 4096) tail = tail.slice(-4096);
    return re.test(text);
  };
}

// o: { priority, sample, silent, timeout } plus, for callers that need more than Done:
//   complete(): true once the caller's own completion is observed (checked after Done),
//   completeTimeout: seconds allowed after Done for complete() to become true.
// deps (tests): { scope, java, jcmd, forge, now, wait, readCpu, setPriority, killTree }.
async function boot(runDir, o, log, deps = {}) {
  const scope = deps.scope || procs.scope();
  const now = deps.now || Date.now;
  const wait = deps.wait || sleep;
  const killTree = deps.killTree || procs.killTree;
  const readCpu = deps.readCpu || ((pid) => procs.cpuSeconds(pid, scope));
  const setPriority = deps.setPriority || ((pid, pr) => procs.setPriority(pid, pr, scope));
  const argsFile = `libraries/net/minecraftforge/forge/${deps.forge || env.FORGE}/win_args.txt`;
  const p = scope.start(deps.java || env.JAVA, ['@user_jvm_args.txt', `@${argsFile}`, 'nogui'], { cwd: runDir, stdio: ['pipe', 'pipe', 'pipe'] });
  const out = fs.createWriteStream(path.join(runDir, 'console.log'));
  const sawDone = lineWatcher(DONE_RE);
  const t0 = now();
  let doneAt = null;
  let crashedAt = null;
  let exited = null;
  let lastLogAt = t0;
  const onData = (d) => {
    out.write(d);
    lastLogAt = now();
    if (sawDone(d.toString()) && doneAt === null) doneAt = now();
  };
  p.stdout.on('data', onData);
  p.stderr.on('data', onData);
  p.on('exit', (c) => { exited = c === null ? -1 : c; });
  if (p.stdin) p.stdin.on('error', () => {});
  const sampler = cpuSampler(readCpu, p.pid, { intervalMs: o.sample * 1000, now });
  const crashDir = path.join(runDir, 'crash-reports');
  let stopReason = null;
  let completed = o.complete ? false : null;
  let completeTimedOut = false;
  let result;
  try {
    const pr = await setPriority(p.pid, o.priority);
    log(pr.skipped ? 'priority: left unchanged' : `priority ${o.priority} on pid ${p.pid}: ${pr.ok ? 'ok' : `FAILED (${pr.out})`}`);
    for (;;) {
      if (exited !== null || (crashedAt && now() - crashedAt > 3000)) break;
      if (crashedAt === null && fs.existsSync(crashDir) && fs.readdirSync(crashDir).length) crashedAt = now();
      if (doneAt !== null) {
        if (!o.complete) break;
        if (o.complete()) { completed = true; break; }
        if (o.completeTimeout && now() - doneAt > o.completeTimeout * 1000) { completeTimedOut = true; break; }
      }
      sampler.tick();
      const t = now();
      stopReason = watchdog({ wallMs: t - t0, sinceLogMs: t - lastLogAt, sinceCpuMs: t - sampler.lastGrowthAt }, { silentMs: o.silent * 1000, hardCapMs: o.timeout * 1000 });
      if (stopReason !== 'ok') break;
      await wait(500);
    }
    await sampler.drain();
  } finally {
    const timedOut = doneAt === null && exited === null && crashedAt === null && stopReason !== null && stopReason !== 'ok';
    if (exited === null) {
      if (doneAt !== null && !crashedAt) log(completed ? 'complete; sending stop' : completeTimedOut ? `completion not seen ${o.completeTimeout}s after Done; sending stop` : 'Done reached; sending stop');
      else log(timedOut ? `${stopReason === 'silent' ? `no log output and no JVM CPU growth for ${o.silent}s` : `hard cap ${o.timeout}s`}; killing process tree` : crashedAt ? 'crash report written; killing process tree' : 'stopping; killing process tree');
    }
    const dump = timedOut ? async () => { await sampler.final(); await threadDump(p.pid, runDir, log, { scope, jcmd: deps.jcmd || env.JCMD }); } : null;
    const ended = await stopServer(p, () => exited !== null, { graceful: doneAt !== null && !crashedAt && !timedOut, dump, scope, killTree, wait, now, log });
    await closeStream(out);
    result = {
      wallSeconds: doneAt ? (doneAt - t0) / 1000 : null,
      totalWallSeconds: (now() - t0) / 1000,
      cpuSeconds: sampler.cpu,
      stopReason,
      timedOut,
      crashed: crashedAt !== null,
      earlyExit: !timedOut && doneAt === null ? exited : null,
      completed,
      completeTimedOut,
      exitedAfterDone: doneAt !== null && completed === false && !completeTimedOut && !crashedAt ? exited : null,
      killed: ended.killed
    };
  }
  return result;
}

module.exports = { boot, lineWatcher };
