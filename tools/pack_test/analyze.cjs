'use strict';
// Offline analysis of one run folder: load the evidence, run every check, compare with the baseline,
// write report.json, summary.txt and baseline-candidate.json. Never boots anything, so `--analyze`
// reproduces a run's verdict exactly from its saved evidence.
const fs = require('node:fs');
const path = require('node:path');
const { loadRun, SECTIONS } = require('./protocol.cjs');
const { validateBaseline, candidate } = require('./baseline.cjs');
const { buildReport, toJson, summarize, EXIT } = require('./report.cjs');
const { checkAcquisition } = require('./checks/acquisition.cjs');
const { compilePolicy, loadToolData } = require('./policy.cjs');
const { checkRecipes } = require('./checks/recipes.cjs');
const { checkReferences } = require('./checks/references.cjs');
const { checkMachines } = require('./checks/machines.cjs');
const { checkCrafting } = require('./checks/crafting.cjs');
const { checkDedup } = require('./checks/dedup.cjs');
const { checkLogs } = require('./checks/logs.cjs');

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);

// The live state as Sets/Maps, built from the probe's registries and tags payloads.
function snapshot(sections) {
  const reg = sections.registries.data;
  const tags = sections.tags.data;
  return {
    registries: {
      items: new Set(reg.items), blocks: new Set(reg.blocks), fluids: new Set(reg.fluids), entities: new Set(reg.entities),
      mods: new Set(Object.keys(reg.mods)), lootTables: new Set(reg.lootTables), modVersions: reg.mods, recipeTypes: reg.recipeTypes
    },
    itemTags: new Map(Object.entries(tags.items)),
    blockTags: new Map(Object.entries(tags.blocks)),
    fluidTags: new Map(Object.entries(tags.fluids || {})),
    recipes: sections.recipes.ok ? sections.recipes.data : []
  };
}

function incomplete(needs, sections) {
  const missing = needs.filter((n) => !sections[n] || !sections[n].ok);
  return missing.length ? { state: 'incomplete', error: `probe sections missing: ${missing.map((n) => `${n} (${(sections[n] && sections[n].error) || 'missing'})`).join('; ')}`, findings: [] } : null;
}

function recipeOutputs(recipes) {
  const { declaredOutputs } = require('./checks/recipes.cjs');
  const out = new Map();
  for (const r of recipes) {
    const ids = new Set(r.out ? [r.out] : []);
    for (const o of declaredOutputs(r.json)) ids.add(o);
    for (const id of ids) { if (!out.has(id)) out.set(id, []); out.get(id).push(r.id); }
  }
  return out;
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
  const resources = fs.existsSync(path.join(ev, 'resources.json')) ? readJson(path.join(ev, 'resources.json')) : null;
  if (!resources) infraErrors.push('raw resource evidence missing');
  const packConfig = (f) => readJson(path.join(ev, 'pack-config', f));
  const S = probe.sections;
  const sections = {};
  const needCore = incomplete(['registries', 'tags'], S);
  const snap = needCore ? null : snapshot(S);
  const latest = readText(path.join(ev, 'logs/latest.log'));
  const kube = readText(path.join(ev, 'logs/kubejs-server.log')) || '';
  const logs = latest !== null && snap ? checkLogs(latest, kube, data.knownNoise, snap.registries.mods) : null;
  const dedupCfg = { policy: packConfig('dedup.json'), sources: packConfig('dedup_sources.json'), allowed: data.allowed };

  sections.recipes = needCore || incomplete(['recipes'], S) || (resources ? checkRecipes(snap, resources, {
    deliberate: new Set(dedupCfg.sources.removeRecipes), parseErrors: logs ? logs.recipeFailures : new Map()
  }) : { state: 'incomplete', error: 'no resource evidence', findings: [] });
  sections.references = needCore || (resources ? checkReferences(resources, { ...snap.registries, itemTags: snap.itemTags, blockTags: snap.blockTags, fluidTags: snap.fluidTags }, {
    removed: data.policy.removedMods, shipped: resources.shipped || [],
    logged: logs ? { droppedTags: logs.droppedTags, failedLoot: new Set(logs.lootFailures.keys()) } : {}
  }) : { state: 'incomplete', error: 'no resource evidence', findings: [] });
  sections.acquisition = needCore || incomplete(['recipes'], S) || (resources ? checkAcquisition({
    recipeOutputs: recipeOutputs(snap.recipes), loot: resources.loot, live: { ...snap.registries, itemTags: snap.itemTags },
    worldgenBlocks: resources.worldgenBlocks, blockItems: new Map()
  }, compilePolicy(data.policy, { dedup: dedupCfg.policy, curated: (data.policy.curatedLists || []).map(packConfig) })) : { state: 'incomplete', error: 'no resource evidence', findings: [] });
  sections.machines = needCore || incomplete(['recipes'], S) || checkMachines(snap.recipes, snap.itemTags, data.machines);
  sections.crafting = incomplete(['crafting'], S) || checkCrafting(S.crafting.data, data.crafts.crafts);
  sections.dedup = needCore || incomplete(['recipes'], S) || checkDedup(snap.itemTags, new Set(snap.recipes.map((r) => r.id)), dedupCfg);
  sections.logs = logs ? { state: logs.state, findings: logs.findings, stats: logs.stats } : { state: 'incomplete', error: 'latest.log missing', findings: [] };
  for (const s of Object.values(sections)) delete s.evidence;

  const model = buildReport({
    run: { ...run.meta, target: run.target, fallback: run.fallback, seed: run.seed, timings: run.timings, world: run.world, runDir: runDir.replace(/\\/g, '/') },
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

function describeBoot(b) {
  if (b.crashed) return 'crash report written';
  if (b.timedOut) return `watchdog ${b.stopReason}`;
  if (b.completeTimedOut) return 'probe deadline after Done';
  if (b.earlyExit !== null && b.earlyExit !== undefined) return `server exited ${b.earlyExit} before Done`;
  if (b.exitedAfterDone !== null && b.exitedAfterDone !== undefined) return `server exited ${b.exitedAfterDone} after Done`;
  return 'unknown';
}

module.exports = { analyzeRun, loadToolData, snapshot, recipeOutputs, EXIT };
