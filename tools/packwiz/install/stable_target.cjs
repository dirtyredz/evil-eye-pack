'use strict';
// Stable target of the neutral install route (verified private jars copied by packwiz as ordinary
// files). Used by scripts/migration/cutover.ps1 for the one-off cutover and by stable-prelaunch.ps1
// to repeat it on every launch. Which instance is Stable is decided in instance_targets.cjs.
const fs = require('node:fs');
const path = require('node:path');
const P = require('../pack_index.cjs');
const { installPack, instanceCfgValue } = require('./install_pack.cjs');
const { noLinks } = require('../../data_io/path_guard.cjs');
const { STABLE, isRealStable, stableTarget } = require('./instance_targets.cjs');

const ROOT = path.resolve(__dirname, '../../..');

function stablePreLaunchCommand(root, cache, instance) {
  const script = path.join(root, 'scripts/migration/stable-prelaunch.ps1');
  const target = isRealStable(instance) ? null : instance;
  if ([script, cache, target || ''].some(s => /["\r\n]/.test(s))) throw Error('Unsafe launcher argument');
  const extra = target ? ` -Instance "${target}"` : '';
  return instanceCfgValue(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${script}" -Cache "${cache}"${extra}`);
}

// A packwiz install skips any file whose pack hash equals the cached hash, even when the file on
// disk was changed by a Forge-era run, and keeps tracked files the new pack dropped. The cutover
// therefore starts clean: delete every file the old install tracked (all archived) except those the
// new index marks preserve, and drop the old packwiz.json. Returns the repo-relative paths removed.
function clearOldTracked(instance, root, dryRun) {
  const state = path.join(instance, 'packwiz.json');
  if (!fs.existsSync(state)) return [];
  const keep = new Set(P.parseIndex(fs.readFileSync(path.join(root, 'index.toml'), 'utf8')).files
    .filter(f => f.preserve).map(f => f.file.toLowerCase()));
  const removed = [];
  for (const entry of Object.values(JSON.parse(fs.readFileSync(state, 'utf8')).cachedFiles || {})) {
    const rel = entry.cachedLocation;
    if (!rel || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..') || keep.has(rel.toLowerCase())) continue;
    const file = path.join(instance, rel);
    noLinks(file);
    if (!fs.existsSync(file)) continue;
    removed.push(rel);
    if (!dryRun) fs.rmSync(file);
  }
  if (!dryRun) fs.rmSync(state);
  return removed;
}

async function main(argv) {
  let cache, dryRun = false, fresh = false, instance = STABLE;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--fresh') fresh = true;
    else if (argv[i] === '--cache' && argv[i + 1]) cache = path.resolve(argv[++i]);
    else if (argv[i] === '--instance' && argv[i + 1]) instance = argv[++i];
    else throw Error('Usage: cutover_install.cjs --cache <cache root> [--instance <.minecraft>] [--fresh] [--dry-run]');
  }
  if (!cache) throw Error('A complete offline --cache is required');
  const target = stableTarget(instance);
  if (fresh) {
    const removed = clearOldTracked(target, ROOT, dryRun);
    console.log(`${dryRun ? 'Would remove' : 'Removed'} ${removed.length} files tracked by the old install (archived); starting clean.`);
  }
  await installPack({ instance: target, cache, dryRun, prelaunch: stablePreLaunchCommand(ROOT, cache, target), backupName: 'stable-instance-before.cfg', label: 'Evil Eye Stable' });
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { clearOldTracked, stablePreLaunchCommand };
