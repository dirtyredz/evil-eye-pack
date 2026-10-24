'use strict';
// Offline analysis of one run folder: load the evidence, run every check, compare with the baseline,
// write report.json, summary.txt and baseline-candidate.json. Never boots anything, so `--analyze`
// reproduces a run's verdict exactly from its saved evidence.
const fs = require('node:fs');
const path = require('node:path');
const { loadRun, SECTIONS } = require('./verdict/protocol.cjs');
const { validateBaseline, candidate } = require('./verdict/baseline.cjs');
const { buildReport, toJson, summarize, EXIT } = require('./verdict/report.cjs');
const { checkAcquisition } = require('./checks/acquisition.cjs');
const { compilePolicy, loadToolData } = require('./verdict/policy.cjs');
const { modeLabel, starvedBoot, starvedText } = require('./verdict/mode.cjs');
const { checkRecipes } = require('./checks/recipes.cjs');
const { snapshot, recipeOutputs } = require('./checks/snapshot.cjs');
const { checkReferences } = require('./checks/references.cjs');
const { checkMachines } = require('./checks/machines.cjs');
const { checkCrafting } = require('./checks/crafting.cjs');
const { checkDedup } = require('./checks/dedup.cjs');
const { checkLogs } = require('./checks/logs.cjs');
const { parseCrashCauses } = require('../server_smoke/verdict.cjs');

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);

function incomplete(needs, sections) {
  const missing = needs.filter((n) => !sections[n] || !sections[n].ok);
  return missing.length ? { state: 'incomplete', error: `probe sections missing: ${missing.map((n) => `${n} (${(sections[n] && sections[n].error) || 'missing'})`).join('; ')}`, findings: [] } : null;
}

function analyzeRun(runDir, { data = loadToolData(), log = () => {} } = {}) {
  const run = readJson(path.join(runDir, 'run.json'));
  const ev = path.join(runDir, 'evidence');
  const infraErrors = [...(run.errors || [])];
  const baselineErrors = validateBaseline(data.baseline);
  if (baselineErrors.length) infraErrors.push(`baseline invalid: ${baselineErrors.slice(0, 5).join('; ')}`);
  const probe = loadRun(path.join(ev, 'probe'), { token: run.input.token, expected: SECTIONS });
  infraErrors.push(...probe.manifestErrors.map((e) => `probe: ${e}`));
  if (run.boot && run.boot.completed !== true) infraErrors.push(`probe did not complete (${describeBoot(run.boot)})`);
  if (starvedBoot(run.boot)) infraErrors.push(starvedText(run.boot, run.shared));
  for (const c of crashCauses(path.join(ev, 'crash-reports'))) infraErrors.push(`crash: ${c}`);
  const resources = fs.existsSync(path.join(ev, 'resources.json')) ? readJson(path.join(ev, 'resources.json')) : null;
  if (!resources) infraErrors.push('raw resource evidence missing');
  const packConfig = (f) => readJson(path.join(ev, 'pack-config', f));
  const S = probe.sections;
  const sections = {};
  const needCore = incomplete(['registries', 'tags'], S);
  const snap = needCore ? null : snapshot(S);
  const latest = readText(path.join(ev, 'logs/latest.log'));
  const kube = readText(path.join(ev, 'logs/kubejs-server.log')) || '';
  const logs = latest !== null ? checkLogs(latest, kube, data.knownNoise, snap ? snap.registries.mods : new Set()) : null;
  const hasPackConfig = fs.existsSync(path.join(ev, 'pack-config', 'dedup.json'));
  if (resources && !hasPackConfig) infraErrors.push('pack config evidence missing');
  const dedupCfg = hasPackConfig ? { policy: packConfig('dedup.json'), sources: packConfig('dedup_sources.json'), allowed: data.allowed } : null;
  const noStaged = { state: 'incomplete', error: 'staged evidence (raw resources, pack config) missing', findings: [] };

  sections.recipes = needCore || incomplete(['recipes'], S) || (resources && dedupCfg ? checkRecipes(snap, resources, {
    deliberate: new Set(dedupCfg.sources.removeRecipes), parseErrors: logs ? logs.recipeFailures : new Map()
  }) : noStaged);
  sections.references = needCore || (resources ? checkReferences(resources, { ...snap.registries, itemTags: snap.itemTags, blockTags: snap.blockTags, fluidTags: snap.fluidTags }, {
    removed: data.policy.removedMods, shipped: resources.shipped || [],
    logged: logs ? { droppedTags: logs.droppedTags, failedLoot: new Set(logs.lootFailures.keys()) } : {}
  }) : noStaged);
  sections.acquisition = needCore || incomplete(['recipes'], S) || (resources && dedupCfg ? checkAcquisition({
    recipeOutputs: recipeOutputs(snap.recipes, snap.registries), loot: resources.loot, live: { ...snap.registries, itemTags: snap.itemTags },
    worldgenBlocks: resources.worldgenBlocks, blockItems: new Map()
  }, compilePolicy(data.policy, { dedup: dedupCfg.policy, curated: (data.policy.curatedLists || []).map(packConfig) })) : noStaged);
  sections.machines = needCore || incomplete(['recipes'], S) || checkMachines(snap.recipes, snap.itemTags, data.machines);
  sections.crafting = incomplete(['crafting'], S) || checkCrafting(S.crafting.data, data.crafts.crafts);
  sections.dedup = needCore || incomplete(['recipes'], S) || (!dedupCfg ? noStaged : checkDedup(snap.itemTags, new Set(snap.recipes.map((r) => r.id)), dedupCfg));
  sections.logs = logs ? { state: logs.state, findings: logs.findings, stats: logs.stats } : { state: 'incomplete', error: 'latest.log missing', findings: [] };
  for (const s of Object.values(sections)) delete s.evidence;

  const model = buildReport({
    run: { ...run.meta, target: run.target, mode: modeLabel(run), fallback: run.fallback, shared: run.shared, sharedAttempt: run.sharedAttempt, seed: run.seed, timings: run.timings, world: run.world, runDir: runDir.replace(/\\/g, '/') },
    boot: run.boot, sections, logs: logs ? logs.analysis : null, baseline: data.baseline, infraErrors
  });
  fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(toJson(model), null, 1));
  fs.writeFileSync(path.join(runDir, 'summary.txt'), summarize(model));
  if (model._cmp.new.length || model._logCmp.new.length) {
    fs.writeFileSync(path.join(runDir, 'baseline-candidate.json'), JSON.stringify(candidate(data.baseline, model._cmp, model._logCmp, path.basename(runDir)), null, 1));
  }
  log(`analysis written: ${path.join(runDir, 'summary.txt')}`);
  return model;
}

// Mod name and failure message from every crash report in the evidence.
function crashCauses(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((f) => parseCrashCauses(fs.readFileSync(path.join(dir, f), 'utf8')).map((c) => `${f}: ${c}`.slice(0, 300)));
}

function describeBoot(b) {
  if (b.crashed) return 'crash report written';
  if (b.timedOut) return `watchdog ${b.stopReason}`;
  if (b.completeTimedOut) return 'probe deadline after Done';
  if (b.earlyExit !== null && b.earlyExit !== undefined) return `server exited ${b.earlyExit} before Done`;
  if (b.exitedAfterDone !== null && b.exitedAfterDone !== undefined) return `server exited ${b.exitedAfterDone} after Done`;
  return 'unknown';
}

module.exports = { analyzeRun, loadToolData, EXIT };
