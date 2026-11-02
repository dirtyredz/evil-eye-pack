'use strict';
// Cutover install: same trial route (verified private jars copied by packwiz as ordinary
// files), but into the Stable instance. Used by scripts/migration/cutover.ps1 for the one-off
// cutover and by stable-prelaunch.ps1 to repeat it on every launch.
const path = require('node:path');
const { installPack, instanceCfgValue } = require('./trial_install.cjs');
const { noLinks } = require('../world_trial/copy.cjs');

const ROOT = path.resolve(__dirname, '../..');
const STABLE = 'C:/Users/dirty/MultiMC/instances/Evil Eye Stable/.minecraft';
const FORBIDDEN = ['evil eye local', 'evil eye neoforge trial'];

// Only the Stable instance (or an explicit copy of it, for rehearsals) is a valid target.
function cutoverInstance(instance) {
  const resolved = path.resolve(instance);
  if (path.basename(resolved) !== '.minecraft') throw Error('Target must be an instance .minecraft folder');
  const lower = resolved.replaceAll(String.fromCharCode(92), '/').toLowerCase();
  if (FORBIDDEN.some(f => lower.includes('/' + f + '/'))) throw Error('Cutover never targets Local or Trial');
  noLinks(resolved);
  return resolved;
}

function stablePreLaunchCommand(root, cache, instance) {
  const script = path.join(root, 'scripts/migration/stable-prelaunch.ps1');
  const target = path.resolve(instance).toLowerCase() === path.resolve(STABLE).toLowerCase() ? null : instance;
  if ([script, cache, target || ''].some(s => /["\r\n]/.test(s))) throw Error('Unsafe launcher argument');
  const extra = target ? ` -Instance "${target}"` : '';
  return instanceCfgValue(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${script}" -Cache "${cache}"${extra}`);
}

async function main(argv) {
  let cache, dryRun = false, instance = STABLE;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--cache' && argv[i + 1]) cache = path.resolve(argv[++i]);
    else if (argv[i] === '--instance' && argv[i + 1]) instance = argv[++i];
    else throw Error('Usage: cutover_install.cjs --cache <cache root> [--instance <.minecraft>] [--dry-run]');
  }
  if (!cache) throw Error('A complete offline --cache is required');
  const target = cutoverInstance(instance);
  await installPack({ instance: target, cache, dryRun, prelaunch: stablePreLaunchCommand(ROOT, cache, target), backupName: 'stable-instance-before.cfg', label: 'Evil Eye Stable' });
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { cutoverInstance, stablePreLaunchCommand, STABLE };
