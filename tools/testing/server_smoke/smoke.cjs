#!/usr/bin/env node
'use strict';
const { readJson } = require('../../data_io/files.cjs');
// Headless server compatibility smoke: boots the pack on the dedicated server its pack.toml declares
// (Forge or NeoForge, with the Java that runtime needs; see runtime.cjs).
// Usage: node tools/testing/server_smoke/smoke.cjs [--pack pack.toml] [--timeout 1800]  hard cap, seconds
//        [--silent 180]  stop when the log is silent AND JVM CPU is flat this many seconds
//        [--priority AboveNormal]  JVM priority class (Idle|BelowNormal|Normal|AboveNormal|High|none)
//        [--sample 10] [--starved 0.25]  CPU sample interval s; HOST STARVED below this many cores per wall second
//        [--port 25599]
//        [--seed 20261020]  level-seed of the fresh world (pinned default; a random seed made boots non-repeatable)
//        [--heap 4G] [--out <dir>] [--cache <dir>]
//        [--analyze <run dir>]  re-report an existing run without booting
//        [--keep-stage]  keep the whole staged server (mods, libraries, world); default keeps only logs, crash reports and settings
//        [--drop oculus,embeddium]  delete installed jars whose name contains a term (to find the next offender)
// Nothing here may show a window: nogui, windowsHide, piped stdio, no launcher, no client.
const fs = require('node:fs');
const path = require('node:path');
const { ARTIFACTS, JAVAS } = require('../../runtime_env/env.cjs');
const { readRuntime, javaPaths, checkJava } = require('../../runtime_env/server/runtime.cjs');
const { ensureLoaderBase, prepareRunDir, readRunSeed, installPack, dropMods } = require('../../server_stage/setup.cjs');
const { analyze } = require('../../data_io/server_log.cjs');
const { boot } = require('../../runtime_env/server/boot.cjs');
const { DEFAULT_STARVED_CORES } = require('../../runtime_env/server/watchdog.cjs');
const { crashReports, crashCauses, decide, EXIT_CODES } = require('./verdict.cjs');
const procs = require('../../runtime_env/procs.cjs');
const { waitForServer } = require('../../runtime_env/server/host_wait.cjs');
const { withStaged } = require('../../runtime_env/staged_dir.cjs');

// What a finished smoke run keeps from its server copy: the evidence the report and a re-analysis read.
const KEEP = /^(logs|crash-reports|console.log|packwiz-install.log|server.properties|runtime.json|stall-threads.txt|hs_err.*|user_jvm_args.txt)$/;

function parseArgs(argv) {
  const o = {
    pack: path.resolve(__dirname, '../../../pack.toml'), timeout: 1800, silent: 180, sample: 10, priority: 'AboveNormal', starved: DEFAULT_STARVED_CORES, port: 25599, heap: '4G', seed: '20261020',
    cache: `${ARTIFACTS}/server-smoke/cache`, drop: '', analyze: '', keepStage: false, out: `${ARTIFACTS}/server-smoke/runs`
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (k === 'keep-stage') { o.keepStage = true; continue; }
    if (!(k in o)) throw new Error(`unknown option ${argv[i]}`);
    o[k] = ['timeout', 'silent', 'sample', 'starved', 'port'].includes(k) ? Number(argv[++i]) : argv[++i];
  }
  o.pack = path.resolve(o.pack);
  return o;
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
  if (o.analyze) { report(o, path.resolve(o.analyze), null); return; }
  fs.mkdirSync(o.cache, { recursive: true });
  const runDir = path.join(o.out, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  let result;
  const scope = procs.scope();
  const interrupt = () => scope.killAll();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  // The server copy is 1-4 GB: pruned to the evidence on every exit path (after the report is read).
  await withStaged({ root: o.out, prune: { dir: runDir, keep: (n) => KEEP.test(n) }, keep: o.keepStage, log }, async () => {
    try {
      const runtime = readRuntime(o.pack);
      const { java, jcmd } = javaPaths(runtime, JAVAS);
      checkJava(java, runtime);
      log(`runtime ${runtime.id} (Java ${runtime.java}: ${java})`);
      const base = await ensureLoaderBase(o.cache, runtime, java, log, scope);
      prepareRunDir(base, runDir, o.port, o.heap, o.seed);
      await installPack(runDir, o.pack, java, o.cache, log, scope);
      dropMods(runDir, o.drop.split(',').filter(Boolean), log);
      log(`mods installed: ${fs.readdirSync(path.join(runDir, 'mods')).filter((f) => f.endsWith('.jar')).length}`);
      await waitForServer(scope, { log });
      result = await boot(runDir, o, log, { runtime, java, jcmd, scope });
    } catch (e) {
      console.log(`FAIL (setup): ${e.message}`);
      process.exitCode = 2;
      return;
    } finally {
      scope.killAll();
      process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    }
    report(o, runDir, result);
  });
}

function report(o, runDir, result) {
  const latest = path.join(runDir, 'logs/latest.log');
  const text = fs.existsSync(latest) ? fs.readFileSync(latest, 'utf8') : '';
  const knownNoise = readJson(path.join(__dirname, 'known_noise.json'));
  const rep = analyze(text, knownNoise);
  const crashes = crashReports(runDir);
  if (!result) o.seed = readRunSeed(runDir) ?? o.seed; // --analyze: the seed is whatever the run was started with
  const { kind, doneText } = decide({ rep, crashCount: crashes.length, boot: result, timeout: o.timeout, seed: o.seed, starvedCores: o.starved });

  console.log(`\n${kind}  pack=${o.pack}  seed=${o.seed}`);
  if (result) console.log(`JVM CPU: ${result.cpuSeconds === null ? 'unknown' : `${result.cpuSeconds.toFixed(1)} s`}   wall: ${Math.round(result.totalWallSeconds)} s   priority: ${o.priority}`);
  console.log(`Done: ${doneText}`);
  console.log(`crash reports: ${crashes.length}   mod loading failed: ${rep.loadingFailed}`);
  for (const c of crashes) {
    console.log(`  ${c}`);
    for (const x of crashCauses(c)) console.log(`    ${x}`);
  }
  printGroups('known boot noise', rep.known);
  printGroups('NEW errors', rep.fresh);
  console.log(`logs: ${latest}\n      ${path.join(runDir, 'console.log')}\n      ${path.join(runDir, 'packwiz-install.log')}`);
  process.exitCode = EXIT_CODES[kind];
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
