#!/usr/bin/env node
'use strict';
// Headless server compatibility smoke: boots the pack on a Forge 1.20.1 dedicated server.
// Usage: node tools/server_smoke/smoke.cjs [--pack pack.toml] [--timeout 600] [--port 25599]
//        [--heap 4G] [--out <dir>] [--cache <dir>]
//        [--analyze <run dir>]  re-report an existing run without booting
//        [--drop oculus,embeddium]  delete installed jars whose name contains a term (to find the next offender)
// Nothing here may show a window: nogui, windowsHide, piped stdio, no launcher, no client.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, killTree } = require('./procs.cjs');
const { ensureForgeBase, prepareRunDir, installPack, FORGE } = require('./setup.cjs');
const { analyze } = require('./log_report.cjs');

const JAVA = 'C:/Users/dirty/MultiMC/jdk-17_windows-x64_bin/jdk-17.0.10/bin/java.exe';
const ARTIFACTS = 'C:/Users/dirty/projects/artifacts/evil-eye-pack';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const o = {
    pack: path.resolve(__dirname, '../../pack.toml'), timeout: 600, port: 25599, heap: '4G',
    cache: `${ARTIFACTS}/server-smoke/cache`, drop: '', analyze: '', out: `${ARTIFACTS}/server-smoke/runs`
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (!(k in o)) throw new Error(`unknown option ${argv[i]}`);
    o[k] = k === 'timeout' || k === 'port' ? Number(argv[++i]) : argv[++i];
  }
  o.pack = path.resolve(o.pack);
  return o;
}

async function boot(runDir, o, log) {
  const argsFile = `libraries/net/minecraftforge/forge/${FORGE}/win_args.txt`;
  const p = spawn(JAVA, ['@user_jvm_args.txt', `@${argsFile}`, 'nogui'],
    { cwd: runDir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const out = fs.createWriteStream(path.join(runDir, 'console.log'));
  let doneAt = null;
  let crashedAt = null;
  let tail = '';
  let exited = null;
  const t0 = Date.now();
  const onData = (d) => {
    out.write(d);
    if (doneAt === null && /Done \([\d.]+s\)!/.test(d.toString())) doneAt = Date.now();
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
    killTree(p.pid);
    await sleep(1500);
  }
  out.end();
  return { wallSeconds: doneAt ? (doneAt - t0) / 1000 : null, timedOut, crashed: crashedAt !== null, earlyExit: !timedOut && doneAt === null ? exited : null };
}

function crashReports(runDir) {
  const d = path.join(runDir, 'crash-reports');
  return fs.existsSync(d) ? fs.readdirSync(d).map((f) => path.join(d, f)) : [];
}

// Forge writes only the first failing mod; pull mod name, file and message from the crash report.
function crashCauses(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
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

function printGroups(title, list) {
  console.log(`${title}: ${list.length} group(s)`);
  for (const g of list.slice(0, 25)) {
    console.log(`  x${g.count}  ${g.signature.slice(0, 200)}${g.why ? `   [${g.why}]` : ''}`);
  }
  if (list.length > 25) console.log(`  ... ${list.length - 25} more in the log`);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const log = (m) => console.log(`[smoke] ${m}`);
  fs.mkdirSync(o.cache, { recursive: true });
  const runDir = path.join(o.out, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  if (o.analyze) { report(o, path.resolve(o.analyze), { wallSeconds: null }); return; }
  let result;
  try {
    const base = await ensureForgeBase(o.cache, JAVA, log);
    prepareRunDir(base, runDir, o.port, o.heap);
    await installPack(runDir, o.pack, JAVA, o.cache, log);
    for (const term of o.drop.split(',').filter(Boolean)) {
      for (const f of fs.readdirSync(path.join(runDir, 'mods'))) {
        if (f.toLowerCase().includes(term.toLowerCase())) { fs.rmSync(path.join(runDir, 'mods', f)); log(`dropped ${f}`); }
      }
    }
    log(`mods installed: ${fs.readdirSync(path.join(runDir, 'mods')).filter((f) => f.endsWith('.jar')).length}`);
    result = await boot(runDir, o, log);
  } catch (e) {
    console.log(`FAIL (setup): ${e.message}`);
    process.exitCode = 2;
    return;
  }
  report(o, runDir, result);
}

function report(o, runDir, result) {
  const latest = path.join(runDir, 'logs/latest.log');
  const text = fs.existsSync(latest) ? fs.readFileSync(latest, 'utf8') : '';
  const knownNoise = JSON.parse(fs.readFileSync(path.join(__dirname, 'known_noise.json'), 'utf8'));
  const rep = analyze(text, knownNoise);
  const crashes = crashReports(runDir);
  const pass = rep.doneSeconds !== null && !crashes.length && !rep.loadingFailed && !rep.fresh.length;
  let doneText = `not reached (server exited ${result.earlyExit})`;
  if (rep.doneSeconds !== null) doneText = `${rep.doneSeconds}s (server)${result.wallSeconds ? ` / ${result.wallSeconds}s (wall, JVM start to Done)` : ''}`;
  else if (result.crashed) doneText = 'not reached (crash report written; JVM was still alive)';
  else if (result.timedOut) doneText = `not reached (timeout ${o.timeout}s)`;
  console.log(`\n${pass ? 'PASS' : 'FAIL'}  pack=${o.pack}`);
  console.log(`Done: ${doneText}`);
  console.log(`crash reports: ${crashes.length}   mod loading failed: ${rep.loadingFailed}`);
  for (const c of crashes) {
    console.log(`  ${c}`);
    for (const x of crashCauses(c)) console.log(`    ${x}`);
  }
  printGroups('known boot noise', rep.known);
  printGroups('NEW errors', rep.fresh);
  console.log(`logs: ${latest}\n      ${path.join(runDir, 'console.log')}\n      ${path.join(runDir, 'packwiz-install.log')}`);
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
