'use strict';
// Local target of the neutral install route: Evil Eye Local only. Local is a disposable, save-free
// copy of Stable: same loader, Minecraft, Java and JVM arguments (taken from Stable's instance files),
// installing the MAIN checkout's pack on every launch. Entry for scripts/instances/local-instance.ps1.
//   --create   build the instance folder (instance.cfg, mmc-pack.json, .packignore) from Stable's; refuses an existing one
//   (default)  install the pack into Local and set its PreLaunchCommand
const fs = require('node:fs');
const path = require('node:path');
const { installPack } = require('../install_pack.cjs');
const { instanceCfgValue, setInstanceCfgValue } = require('../instance_cfg.cjs');
const { LOCAL, LOCAL_INSTANCE, STABLE_INSTANCE, localTarget } = require('../instance_targets.cjs');
const { noLinks } = require('../../../data_io/path_guard.cjs');

const { MAIN_CHECKOUT } = require('../../../runtime_env/env.cjs').FIXED;
const ROOT = path.resolve(__dirname, '../../../..');
// Stable settings that belong to its play history, not to its configuration.
const HISTORY_KEYS = ['lastLaunchTime', 'lastTimePlayed', 'totalTimePlayed'];

function localPreLaunchCommand(cache) {
  const script = path.posix.join(MAIN_CHECKOUT, 'scripts/instances/local-instance.ps1');
  if ([script, cache].some(s => /["\r\n]/.test(s))) throw Error('Unsafe launcher argument');
  return instanceCfgValue(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${script}" -Cache "${cache}"`);
}

// Pure: Stable's instance.cfg text becomes Local's (name changed, play history dropped).
function localCfgFromStable(stableCfg) {
  let text = stableCfg.replace(/\r\n/g, '\n');
  for (const key of HISTORY_KEYS) text = text.replace(new RegExp(`^${key}=[^\n]*\n`, 'm'), '');
  return setInstanceCfgValue(text, 'name', 'Evil Eye Local');
}

function createInstance(dryRun) {
  if (fs.existsSync(LOCAL_INSTANCE)) throw Error(`${LOCAL_INSTANCE} exists; move it away first (this never overwrites)`);
  const read = f => fs.readFileSync(path.join(STABLE_INSTANCE, f));
  const cfg = localCfgFromStable(read('instance.cfg').toString('utf8'));
  console.log(`${dryRun ? 'Would create' : 'Creating'} ${LOCAL_INSTANCE} from Stable's instance.cfg, mmc-pack.json and .packignore (read only; no saves, no .minecraft copied).`);
  if (dryRun) return;
  fs.mkdirSync(LOCAL, { recursive: true });
  fs.mkdirSync(path.join(LOCAL_INSTANCE, 'patches'));
  fs.writeFileSync(path.join(LOCAL_INSTANCE, 'instance.cfg'), cfg);
  fs.writeFileSync(path.join(LOCAL_INSTANCE, 'mmc-pack.json'), read('mmc-pack.json'));
  fs.writeFileSync(path.join(LOCAL_INSTANCE, '.packignore'), read('.packignore'));
}

async function main(argv) {
  let cache, dryRun = false, create = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--create') create = true;
    else if (argv[i] === '--cache' && argv[i + 1]) cache = path.resolve(argv[++i]);
    else throw Error('Usage: local_target.cjs --cache <cache root> [--create] [--dry-run]');
  }
  if (!cache) throw Error('A complete offline --cache is required');
  if (create) createInstance(dryRun);
  if (create && dryRun) { // nothing exists yet: verify the pack and cache against a scratch-free dry install
    const { prepareFiles } = require('../install_pack.cjs');
    console.log(`Verified ${prepareFiles(ROOT, cache).length} local files from ${ROOT}; dry run, nothing written.`);
    return;
  }
  const instance = localTarget(LOCAL);
  await installPack({ instance, cache, dryRun, prelaunch: localPreLaunchCommand(cache), backupName: 'local-instance-before.cfg', label: 'Evil Eye Local' });
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { localPreLaunchCommand, localCfgFromStable };
