'use strict';
// Boots the prepared server dir hidden, waits for Done or a crash, then stop (kill the tree if it will not).
const fs = require('node:fs');
const path = require('node:path');
const procs = require('./procs.cjs');
const { JAVA, FORGE } = require('./env.cjs');
const { DONE_RE } = require('./log_report.cjs');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(runDir, o, log) {
  const argsFile = `libraries/net/minecraftforge/forge/${FORGE}/win_args.txt`;
  const p = procs.start(JAVA, ['@user_jvm_args.txt', `@${argsFile}`, 'nogui'], { cwd: runDir, stdio: ['pipe', 'pipe', 'pipe'] });
  const out = fs.createWriteStream(path.join(runDir, 'console.log'));
  let doneAt = null;
  let crashedAt = null;
  let exited = null;
  const t0 = Date.now();
  const onData = (d) => {
    out.write(d);
    if (doneAt === null && DONE_RE.test(d.toString())) doneAt = Date.now();
  };
  p.stdout.on('data', onData);
  p.stderr.on('data', onData);
  p.on('exit', (c) => { exited = c === null ? -1 : c; });
  p.stdin.on('error', () => {});
  const deadline = t0 + o.timeout * 1000;
  const crashDir = path.join(runDir, 'crash-reports');
  while (doneAt === null && exited === null && Date.now() < deadline && !(crashedAt && Date.now() - crashedAt > 3000)) {
    if (crashedAt === null && fs.existsSync(crashDir) && fs.readdirSync(crashDir).length) crashedAt = Date.now();
    await sleep(500);
  }
  const timedOut = doneAt === null && exited === null && crashedAt === null;
  if (doneAt !== null && exited === null) {
    log('Done reached; sending stop');
    p.stdin.write('stop\n');
    const stopBy = Date.now() + 60000;
    while (exited === null && Date.now() < stopBy) await sleep(500);
  }
  if (exited === null) {
    log(timedOut ? 'timeout; killing process tree' : crashedAt ? 'crash report written; killing process tree' : 'stop did not finish; killing process tree');
    procs.killTree(p.pid);
    await sleep(1500);
  }
  out.end();
  return { wallSeconds: doneAt ? (doneAt - t0) / 1000 : null, timedOut, crashed: crashedAt !== null, earlyExit: !timedOut && doneAt === null ? exited : null };
}

module.exports = { boot };
