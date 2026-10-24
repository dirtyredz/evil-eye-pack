'use strict';
const { setTimeout: sleep } = require('node:timers/promises');
// Ending a server boot: console `stop` with a grace period, an optional jcmd thread dump, then a tree kill.
// Every wait is bounded so a stuck JVM or a stuck jcmd can never hold up cleanup.
const fs = require('node:fs');
const path = require('node:path');


// Saves `jcmd <pid> Thread.print` to stall-threads.txt so a stall can be pinned to the stuck thread.
async function threadDump(pid, runDir, log, { scope, jcmd, timeoutMs = 60000 }) {
  const r = await scope.run(jcmd, [String(pid), 'Thread.print'], { cwd: runDir, timeoutMs });
  const file = path.join(runDir, 'stall-threads.txt');
  fs.writeFileSync(file, r.out);
  log(`stall: thread dump saved to ${file} (jcmd ${r.timedOut ? 'timed out' : `exit ${r.code}`})`);
}

// p: the server child; isExited(): whether it has exited. graceful: send `stop` first.
// dump: take a thread dump before killing. Returns how it ended.
async function stopServer(p, isExited, { graceful, graceMs = 60000, dump = null, killWaitMs = 10000, scope, killTree, wait = sleep, now = Date.now, log }) {
  const result = { stopSent: false, killed: false, exitedInGrace: false };
  if (isExited()) return result;
  if (graceful && p.stdin && p.stdin.writable) {
    p.stdin.write('stop\n');
    result.stopSent = true;
    const by = now() + graceMs;
    while (!isExited() && now() < by) await wait(250);
    result.exitedInGrace = isExited();
  }
  if (!isExited()) {
    if (dump) await dump();
    killTree(p.pid);
    result.killed = true;
    const by = now() + killWaitMs;
    while (!isExited() && now() < by) await wait(250);
  }
  if (scope) scope.killAll({ cancel: false }); // helpers (a stray jcmd or powershell) never outlive the boot
  if (log) log(`server stopped (${result.stopSent ? 'stop sent' : 'no stop'}${result.killed ? ', tree killed' : ''})`);
  return result;
}

// Resolves once a write stream has flushed and closed (bounded).
function closeStream(stream, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, timeoutMs);
    stream.end(() => { clearTimeout(t); resolve(); });
  });
}

module.exports = { threadDump, stopServer, closeStream };
