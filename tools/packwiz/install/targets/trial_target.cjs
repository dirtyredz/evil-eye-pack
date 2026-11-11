'use strict';
// Trial target of the neutral install route: Evil Eye NeoForge Trial only, with its own prelaunch.
// Entry for scripts/migration/trial-walkthrough.ps1.
const path = require('node:path');
const { installPack } = require('../install_pack.cjs');
const { instanceCfgValue } = require('../instance_cfg.cjs');
const { TRIAL, trialTarget } = require('../instance_targets.cjs');

const ROOT = path.resolve(__dirname, '../../../..');

function trialPreLaunchCommand(root, cache) {
  const script = path.join(root, 'scripts/migration/trial-walkthrough.ps1');
  if ([script, cache].some(s => /["\r\n]/.test(s))) throw Error('Unsafe launcher argument');
  return instanceCfgValue(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${script}" -Cache "${cache}"`);
}

async function main(argv) {
  let cache, dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--cache' && argv[i + 1]) cache = path.resolve(argv[++i]);
    else throw Error('Usage: trial_target.cjs --cache <cache root> [--dry-run]');
  }
  if (!cache) throw Error('A complete offline --cache is required');
  const instance = trialTarget(TRIAL);
  await installPack({ instance, cache, dryRun, prelaunch: trialPreLaunchCommand(ROOT, cache), backupName: 'trial-instance-before.cfg', label: 'Evil Eye NeoForge Trial' });
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { trialPreLaunchCommand, trialInstance: trialTarget };
