#!/usr/bin/env node
'use strict';
// Automated pack test: ONE hidden Forge dedicated-server boot of this checkout (no client, no window),
// a KubeJS probe injected into the throwaway server only, then recipe, reference, acquisition, machine,
// crafting, duplicate-material and log checks against data/baseline.json.
//
// Usage: node tools/pack_test/run.cjs [--local] [--pack pack.toml] [--out <job dir>] [--seed 20261020]
//        [--priority AboveNormal] [--timeout 1800] [--silent 180] [--sample 10] [--probe-timeout 300]
//        [--heap 6G] [--port 25601] [--fresh-world] [--keep-server]
//        node tools/pack_test/run.cjs --analyze <run dir>     re-analyse saved evidence, no boot
// Target: ANU by default (see docs/development.md); --local runs on this machine. ANU is used alone, or
// beside another project's running job when it has room (free RAM and CPU); an unreachable ANU, a held
// pack-test lock or no room falls back to this machine at once, and the summary's first line says which
// mode ran. A shared ANU run that was CPU-starved is re-run once on this machine.
// Exit: 0 no new findings; 1 new findings; 2 invalid/incomplete run, setup or cleanup failure.
const fs = require('node:fs');
const path = require('node:path');
const env = require('../server_smoke/env.cjs');
const procs = require('../server_smoke/procs.cjs');
const { verify } = require('../packwiz/verify_hashes.cjs');
const prep = require('./session/prepare.cjs');
const { checkDestination, runId, runMeta } = require('./session/run_meta.cjs');
const { runTarget } = require('./session/target.cjs');
const { analyzeRun, EXIT } = require('./analyze.cjs');
const { loadToolData } = require('./verdict/policy.cjs');
const { stageEvidence } = require('./session/evidence.cjs');
const { localLock } = require('./session/lock.cjs');
const { abortRegistry } = require('./session/aborts.cjs');

const ROOT = path.resolve(__dirname, '../..');
const NUM = new Set(['timeout', 'silent', 'sample', 'probeTimeout', 'port']);
const FLAGS = new Set(['local', 'freshWorld', 'keepServer']);

function parseArgs(argv) {
  const o = {
    pack: path.join(ROOT, 'pack.toml'), out: `${env.ARTIFACTS}/pack-test/runs`, seed: '20261020', priority: 'AboveNormal',
    timeout: 1800, silent: 180, sample: 10, probeTimeout: 300, heap: '6G', port: 25601, analyze: '', local: false,
    freshWorld: false, keepServer: false
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (!(k in o)) throw new Error(`unknown option ${argv[i]}`);
    if (FLAGS.has(k)) o[k] = true;
    else o[k] = NUM.has(k) ? Number(argv[++i]) : argv[++i];
  }
  o.pack = path.resolve(o.pack);
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const log = (m) => console.log(`[pack-test] ${m}`);
  if (o.analyze) { finish(analyzeRun(path.resolve(o.analyze), { log })); return; }

  const runDir = path.join(path.resolve(o.out), runId());
  checkDestination(runDir, { artifacts: env.ARTIFACTS, checkouts: [ROOT, path.dirname(o.pack)] });
  fs.mkdirSync(runDir, { recursive: true });
  const data = loadToolData();
  const scope = procs.scope();
  const aborts = abortRegistry();
  const onSignal = async () => {
    log('interrupted; stopping every process this run started');
    await aborts.runAll();
    scope.killAll();
    process.exit(EXIT.INVALID);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  const run = { schema: 1, meta: runMeta(o.pack), seed: o.seed, target: 'local', fallback: null, errors: [], timings: {}, input: { token: `${path.basename(runDir)}-${process.pid}`, crafts: data.crafts.crafts.map((c) => ({ name: c.name, recipe: c.recipe, grid: c.grid.map((g) => g || '') })) } };
  const save = () => fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(run, null, 1));
  const t0 = Date.now();
  let lock = null;
  try {
    const v = verify(path.dirname(o.pack));
    if (v.problems.length) throw new Error(`pack hash chain does not verify: ${v.problems.slice(0, 3).join('; ')}`);
    const stageRoot = `${env.ARTIFACTS}/pack-test/stage`;
    lock = localLock(`${env.ARTIFACTS}/pack-test/stage.lock`);
    let t = Date.now();
    const stageDir = await prep.ensureStage(path.join(stageRoot, 'server'), { cache: `${env.ARTIFACTS}/server-smoke/cache`, java: env.JAVA, pack: o.pack, log, scope, seed: o.seed, port: o.port, heap: o.heap });
    run.timings.stage = (Date.now() - t) / 1000;
    t = Date.now();
    stageEvidence(stageDir, path.join(runDir, 'evidence'), data);
    run.timings.scan = (Date.now() - t) / 1000;
    await runTarget({ options: o, stageDir, runDir, run, worldCache: `${env.ARTIFACTS}/pack-test/cache/worlds`, scope,
      onAbort: aborts.register, onSynced: () => { if (lock) { lock.release(); lock = null; } } }, log);
  } catch (e) {
    run.errors.push(`setup/boot: ${e.message}`);
    log(`FAILED: ${e.stack || e.message}`);
  } finally {
    const leftovers = scope.killAll();
    if (leftovers.length) run.errors.push(`cleanup: killed ${leftovers.length} leftover process(es)`);
    if (lock) lock.release();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    run.timings.total = (Date.now() - t0) / 1000;
    save();
  }
  finish(analyzeRun(runDir, { data, log }));
}

function finish(model) {
  process.stdout.write(`\n${fs.readFileSync(path.join(model.run.runDir, 'summary.txt'), 'utf8')}`);
  console.log(`report: ${model.run.runDir}/report.json`);
  process.exitCode = model.verdict.exit;
}

main().catch((e) => { console.error(e); process.exitCode = EXIT.INVALID; });
