#!/usr/bin/env node
'use strict';
// Automated pack test: ONE hidden Forge dedicated-server boot of this checkout (no client, no window),
// a KubeJS probe injected into the throwaway server only, then recipe, reference, acquisition, machine,
// crafting, duplicate-material and log checks against data/baseline.json.
//
// Usage: node tools/pack_test/run.cjs [--local] [--pack pack.toml] [--out <job dir>] [--seed 20261020]
//        [--priority AboveNormal] [--timeout 1800] [--silent 180] [--sample 10] [--probe-timeout 300]
//        [--heap 6G] [--port 25601] [--fresh-world] [--keep-server] [--anu-wait 600]
//        node tools/pack_test/run.cjs --analyze <run dir>     re-analyse saved evidence, no boot
// Target: ANU by default (see docs/development.md); --local runs on this machine. An unreachable or busy
// ANU falls back to this machine, and the summary says so.
// Exit: 0 no new findings; 1 new findings; 2 invalid/incomplete run, setup or cleanup failure.
const fs = require('node:fs');
const path = require('node:path');
const env = require('../server_smoke/env.cjs');
const procs = require('../server_smoke/procs.cjs');
const { verify } = require('../packwiz/verify_hashes.cjs');
const prep = require('./prepare.cjs');
const { execute } = require('./execute.cjs');
const { analyzeRun, EXIT } = require('./analyze.cjs');
const { loadToolData } = require('./policy.cjs');
const { scanResources, serverSources } = require('./resources.cjs');
const { localLock } = require('./lock.cjs');

const ROOT = path.resolve(__dirname, '../..');
const NUM = new Set(['timeout', 'silent', 'sample', 'probeTimeout', 'port', 'anuWait']);
const FLAGS = new Set(['local', 'freshWorld', 'keepServer']);

function parseArgs(argv) {
  const o = {
    pack: path.join(ROOT, 'pack.toml'), out: `${env.ARTIFACTS}/pack-test/runs`, seed: '20261020', priority: 'AboveNormal',
    timeout: 1800, silent: 180, sample: 10, probeTimeout: 300, heap: '6G', port: 25601, analyze: '', local: false,
    freshWorld: false, keepServer: false, anuWait: 600
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

const PACK_CONFIG = ['kubejs/config/dedup.json', 'kubejs/config/dedup_sources.json', 'config/emi-curation/creative.json', 'config/emi-curation/minecolonies-eggs.json'];

// Raw resources, shipped-config mentions and the pack's own policy files, read from the staged server.
function stageEvidence(stageDir, evidenceDir, data) {
  fs.mkdirSync(path.join(evidenceDir, 'pack-config'), { recursive: true });
  const ev = scanResources(serverSources(stageDir), { removedNamespaces: data.policy.removedMods });
  ev.shipped = prep.shippedMentions(stageDir, data.policy.removedMods);
  fs.writeFileSync(path.join(evidenceDir, 'resources.json'), JSON.stringify(ev));
  for (const f of PACK_CONFIG) fs.copyFileSync(path.join(stageDir, f), path.join(evidenceDir, 'pack-config', path.basename(f)));
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const log = (m) => console.log(`[pack-test] ${m}`);
  if (o.analyze) { finish(analyzeRun(path.resolve(o.analyze), { log })); return; }

  const runDir = path.join(path.resolve(o.out), prep.runId());
  prep.checkDestination(runDir, { artifacts: env.ARTIFACTS, checkouts: [ROOT, path.dirname(o.pack)] });
  fs.mkdirSync(runDir, { recursive: true });
  const data = loadToolData();
  const scope = procs.scope();
  const onSignal = () => { log('interrupted; stopping every process this run started'); scope.killAll(); process.exit(EXIT.INVALID); };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  const run = { schema: 1, meta: prep.runMeta(o.pack), seed: o.seed, target: 'local', fallback: null, errors: [], timings: {}, input: { token: `${path.basename(runDir)}-${process.pid}`, crafts: data.crafts.crafts.map((c) => ({ name: c.name, recipe: c.recipe, grid: c.grid.map((g) => g || '') })) } };
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
    const bootOpts = { priority: o.priority, sample: o.sample, silent: o.silent, timeout: o.timeout, probeTimeout: o.probeTimeout };
    let remote = null;
    if (!o.local) {
      const { runOnAnu } = require('./remote/anu.cjs');
      remote = await runOnAnu({ stageDir, runDir, input: run.input, seed: o.seed, port: o.port, heap: o.heap, boot: { ...bootOpts, priority: 'BelowNormal' }, freshWorld: o.freshWorld, anuWait: o.anuWait, scope, log });
      if (remote.fallback) { run.fallback = remote.fallback; log(`ANU not used: ${remote.fallback}; running on this machine`); }
    }
    if (remote && !remote.fallback) {
      Object.assign(run, { target: 'anu', boot: remote.boot, world: remote.world });
      Object.assign(run.timings, remote.timings);
    } else {
      const r = await execute({ stageDir, runDir, worldCache: `${env.ARTIFACTS}/pack-test/cache/worlds`, input: run.input, seed: o.seed, port: o.port, heap: o.heap, boot: bootOpts, freshWorld: o.freshWorld, keepServer: o.keepServer, scope }, log);
      Object.assign(run, { target: 'local', boot: r.boot, world: r.world });
      Object.assign(run.timings, r.timings);
    }
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
