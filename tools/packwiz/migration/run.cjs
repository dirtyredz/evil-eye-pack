'use strict';
// Migration CLI orchestration (entry: tools/packwiz/migration/migrate.mjs, through script-run).
//   resolve   build target-lock.json: plan selectors, fetch and verify every artifact, read jar
//             metadata, check the dependency closure, write the lock and a report in the job folder
//   check     validate the lock against this checkout, re-verify every cached artifact (complete
//             inventory) and re-run the closure check, offline
//   apply     plan the re-point from the lock; a dry run unless --write is given (dry run is the default).
//             After the first apply it brings the already-applied checkout to an updated lock's target.
// A resolve after apply reads the source metafiles from the commit the lock records (source_tree.cjs).
const fs = require('node:fs');
const path = require('node:path');
const env = require('../../testing/server_smoke/runtime/env.cjs');
const { readJson, sha256 } = require('../../data_io/files.cjs');
const { readJarMods } = require('../../data_io/mod_metadata.cjs');
const { SCHEMA, fingerprint, serialize, sourceMetafiles, validate } = require('./manifest.cjs');
const { planEntries } = require('./resolve.cjs');
const { client, resolveSelector, resolveInstaller } = require('./fetch.cjs');
const { checkClosure } = require('./dependencies.cjs');
const { plan, planApplied, apply, appliedDifferences } = require('./repoint.cjs');
const { sourceRoot } = require('./source_tree.cjs');

const ROOT = path.resolve(__dirname, '../../..');
const HERE = __dirname;
const DEFAULTS = {
  lock: path.join(HERE, 'target-lock.json'),
  dispositions: path.join(HERE, 'dispositions.json'),
  survey: `${env.ARTIFACTS}/jobs/2026-10-29-neoforge-availability/bulk-results.json`,
  job: `${env.ARTIFACTS}/jobs/2026-10-29-neoforge-lock`,
  cache: `${env.ARTIFACTS}/migration/neoforge-1.21.1/cache`
};

function parse(argv) {
  const [command, ...rest] = argv;
  const o = { ...DEFAULTS, write: false, root: ROOT };
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i].replace(/^--/, '');
    if (k === 'write') { o.write = true; continue; }
    if (!(k in DEFAULTS) && k !== 'root') throw new Error(`unknown option ${rest[i]}`);
    o[k] = path.resolve(rest[++i]);
    if (k === 'root') o.explicitRoot = o.root;
  }
  if (!['resolve', 'check', 'apply'].includes(command)) throw new Error('usage: migrate.mjs resolve|check|apply [--write] [--lock f] [--cache d] [--job d] [--survey f] [--dispositions f]');
  return { command, o };
}

const compactDeps = (units) => units.flatMap(u => u.mods.flatMap(m => m.dependencies.filter(d => d.type !== 'optional' || d.range)
  .map(d => `${m.id} ${d.type} ${d.id} ${d.range || '*'}${String(d.side).toUpperCase() !== 'BOTH' ? ` (${String(d.side).toLowerCase()})` : ''}`))).sort();
const compactMods = (units) => units.flatMap(u => u.mods.map(m => `${m.id}@${m.version ?? '?'}${u.bundled ? ' (bundled)' : ''}`));

// Jar entries for the closure check, from the cached bytes each target pins.
function closureInput(lock, cache) {
  const missing = [], entries = [];
  for (const e of lock.entries) {
    if (!e.target || !e.target.metafile.startsWith('mods/')) continue;
    const file = path.join(cache, 'mods', e.target.source === 'local' ? `${e.target.sha256}.jar` : e.target.filename);
    if (!fs.existsSync(file)) { missing.push(`${e.target.metafile}: cached artifact missing (${file})`); continue; }
    const bytes = fs.readFileSync(file);
    if (sha256(bytes) !== e.target.sha256 || bytes.length !== e.target.size) { missing.push(`${e.target.metafile}: cached artifact differs from the lock`); continue; }
    entries.push({ key: e.target.metafile, side: e.target.side, units: readJarMods(bytes, e.target.filename) });
  }
  return { entries, missing };
}

// Every non-jar target (resource/shader packs) must also be present with its locked bytes.
function verifyPacks(lock, cache) {
  const out = [];
  for (const e of lock.entries) {
    if (!e.target || e.target.metafile.startsWith('mods/')) continue;
    const file = path.join(cache, e.target.metafile.split('/')[0], e.target.filename);
    if (!fs.existsSync(file) || sha256(fs.readFileSync(file)) !== e.target.sha256) out.push(`${e.target.metafile}: cached artifact missing or different`);
  }
  return out;
}

async function resolve(o, log) {
  const dispositions = readJson(o.dispositions);
  const previous = fs.existsSync(o.lock) ? readJson(o.lock) : null;
  const src = sourceRoot({ root: o.root, explicitRoot: o.explicitRoot, lock: previous, scratch: path.join(o.root, '.tmp', 'migration-source') });
  if (src.commit) log(`checkout is past the lock source: resolving from source commit ${src.commit}`);
  o = { ...o, root: src.root };
  const survey = readJson(o.survey);
  const rt = dispositions.runtime;
  const api = client({ rawDir: path.join(o.job, 'raw'), log });
  const lookup = { modrinthVersions: (p) => api.json(`mr-project-versions-${p}.json`, `https://api.modrinth.com/v2/project/${p}/version`) };
  const planned = await planEntries({ root: o.root, survey, dispositions, minecraft: rt.minecraft, lookup });
  const entries = [];
  const failures = [];
  const queue = [...planned];
  const work = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const { selector, targetMetafile, name, side, ...rest } = p;
      if (!selector) { entries.push(rest); continue; }
      const folder = targetMetafile.split('/')[0];
      try {
        const tags = folder === 'mods' ? { minecraft: rt.minecraft, loader: 'neoforge' } : { minecraft: rt.minecraft };
        const r = await resolveSelector(selector, { api, cacheDir: o.cache, folder, tags });
        const target = { metafile: targetMetafile, name, side, ...r.fields };
        if (folder === 'mods') {
          const units = readJarMods(r.bytes, r.fields.filename);
          Object.assign(target, { loader: units[0].loader, mods: compactMods(units), declares: compactDeps(units) });
        }
        entries.push({ ...rest, target });
      } catch (e) { failures.push(`${p.metafile}: ${e.message}`); }
    }
  };
  await Promise.all([work(), work(), work(), work()]);
  if (failures.length) throw new Error(`could not resolve ${failures.length} entr(ies):\n  ${failures.sort().join('\n  ')}`);
  const installer = await resolveInstaller(rt.loaderVersion, { api, cacheDir: o.cache });
  const lock = {
    schema: SCHEMA,
    runtime: { ...rt, installer: { url: installer.url, sha256: installer.sha256, size: installer.size } },
    source: sourceRecord(o.root, previous, src.commit),
    frozen: dispositions.frozen,
    entries
  };
  const errors = validate(lock, sourceMetafiles(o.root));
  const closure = checkClosure(closureInput(lock, o.cache).entries, { minecraft: rt.minecraft, neoforge: rt.loaderVersion, java: rt.java }, { waivers: dispositions.waivers });
  lock.closure = { errors: closure.errors.length, warnings: closure.warnings };
  fs.writeFileSync(o.lock, serialize(lock));
  fs.mkdirSync(o.job, { recursive: true });
  fs.writeFileSync(path.join(o.job, 'resolve-report.json'), JSON.stringify({ validation: errors, closure: { errors: closure.errors, warnings: closure.warnings }, counts: counts(lock) }, null, 1) + '\n');
  report(log, lock, errors, closure);
  return errors.length || closure.errors.length ? 1 : 0;
}

// The source a lock was built from; its commit is kept while the fingerprint is unchanged.
function sourceRecord(root, previous, commit) {
  const fp = fingerprint(root);
  const keep = commit || (previous?.source?.fingerprint === fp ? previous.source.commit : null);
  return { fingerprint: fp, metafiles: sourceMetafiles(root).length, ...(keep ? { commit: keep } : {}) };
}

function counts(lock) {
  const c = {};
  for (const e of lock.entries) c[e.action] = (c[e.action] || 0) + 1;
  return c;
}

function report(log, lock, errors, closure, missing = []) {
  log(`lock: ${lock.entries.length} entries ${JSON.stringify(counts(lock))}; source metafiles ${lock.source.metafiles}`);
  for (const e of errors) log(`INVALID ${e}`);
  for (const m of missing) log(`MISSING ${m}`);
  for (const e of closure.errors) log(`DEPENDENCY ${e}`);
  for (const w of closure.warnings) log(`WARNING ${w}`);
  log(`validation errors ${errors.length}, missing artifacts ${missing.length}, dependency errors ${closure.errors.length}, warnings ${closure.warnings.length}`);
}

function check(o, log) {
  const lock = readJson(o.lock);
  // Before apply the checkout must be the lock's source; after apply it must be exactly the lock's target.
  const applied = lock.source?.fingerprint !== fingerprint(o.root);
  const errors = applied ? appliedDifferences(o.root, lock) : validate(lock, sourceMetafiles(o.root));
  log(applied ? 'checkout is past the lock source: checking it is exactly the applied target state' : 'checkout is the lock source');
  const { entries, missing } = closureInput(lock, o.cache);
  missing.push(...verifyPacks(lock, o.cache));
  const rt = lock.runtime;
  const closure = checkClosure(entries, { minecraft: rt.minecraft, neoforge: rt.loaderVersion, java: rt.java }, { waivers: readJson(o.dispositions).waivers });
  report(log, lock, errors, closure, missing);
  return errors.length || missing.length || closure.errors.length ? 1 : 0;
}

function applyCommand(o, log, { dryRun }) {
  const lock = readJson(o.lock);
  const applied = lock.source?.fingerprint !== fingerprint(o.root);
  if (applied) log('checkout is past the lock source: planning the update from the applied state');
  const changes = applied ? planApplied(o.root, lock) : plan(o.root, lock);
  log(`re-point plan: ${changes.writes.length} write(s), ${changes.deletes.length} delete(s) ${JSON.stringify(changes.summary)}`);
  for (const w of changes.writes) log(`  write ${w.rel}`);
  for (const d of changes.deletes) log(`  delete ${d}`);
  if (dryRun || !o.write) { log('dry run: nothing written (pass --write to apply, then rehash)'); return 0; }
  apply(o.root, changes);
  log('applied; now run node tools/packwiz/rehash.cjs and verify_hashes.cjs');
  return 0;
}

async function run(argv, { dryRun = false, log = console.log } = {}) {
  const { command, o } = parse(argv);
  const code = command === 'resolve' ? await resolve(o, log) : command === 'check' ? check(o, log) : applyCommand(o, log, { dryRun });
  if (code) throw Object.assign(new Error(`${command} found problems (see above)`), { exitCode: code });
}

module.exports = { run, parse, closureInput, DEFAULTS };
