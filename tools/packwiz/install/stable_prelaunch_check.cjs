'use strict';
// Guard for Evil Eye Stable's MultiMC pre-launch command. Stable only updates because its
// PreLaunchCommand runs scripts/migration/stable-prelaunch.ps1; MultiMC rewrites instance.cfg from
// memory, so a blank value (2026-11-08: an empty value was in memory by 23:06 and every launch since
// skipped the install) silently freezes Stable on old jars. Nothing else notices.
//   node tools/packwiz/install/stable_prelaunch_check.cjs            exit 1 and print the problem when the command is wrong or missing
//   node tools/packwiz/install/stable_prelaunch_check.cjs --fix      rewrite it (only the PreLaunchCommand and OverrideCommands lines)
//   --cache <dir>   cache for --fix (default: the cache Evil Eye Local's cfg already names, else the world-trial-final cache)
//   --cfg <file>    check a copy instead of the real Stable instance.cfg
// --fix while MultiMC is open is overwritten the next time MultiMC saves: close MultiMC first.
const fs = require('node:fs');
const path = require('node:path');
const { setInstanceCfgValue } = require('./install_pack.cjs');
const { stablePreLaunchCommand } = require('./stable_target.cjs');
const { STABLE_INSTANCE, LOCAL_INSTANCE, MAIN_CHECKOUT } = require('./instance_targets.cjs');

const DEFAULT_CACHE = 'C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-world-trial-final/cache';
const SCRIPT = 'scripts/migration/stable-prelaunch.ps1';
const cfgValue = (text, key) => (text.match(new RegExp(`^${key}=([^\r\n]*)`, 'm')) || [])[1];

// Pure: problems with Stable's instance.cfg text (empty list when it will run the install).
function stablePrelaunchProblems(cfgText) {
  const problems = [];
  if (cfgValue(cfgText, 'OverrideCommands') !== 'true') problems.push('OverrideCommands is not true (MultiMC ignores the instance PreLaunchCommand)');
  const cmd = cfgValue(cfgText, 'PreLaunchCommand');
  if (!cmd) problems.push('PreLaunchCommand is empty: Stable will not update on launch');
  else if (!cmd.includes(SCRIPT)) problems.push(`PreLaunchCommand does not run ${SCRIPT}: ${cmd}`);
  else if (!/-Cache "[^"]+"/.test(cmd)) problems.push('PreLaunchCommand has no -Cache argument');
  return problems;
}

// Pure: the repaired text.
function fixStableCfg(cfgText, cache) {
  const withOverride = setInstanceCfgValue(cfgText, 'OverrideCommands', 'true');
  return setInstanceCfgValue(withOverride, 'PreLaunchCommand', stablePreLaunchCommand(MAIN_CHECKOUT, cache, STABLE_INSTANCE));
}

function localCache() {
  try {
    const m = /-Cache "([^"]+)"/.exec(cfgValue(fs.readFileSync(path.join(LOCAL_INSTANCE, 'instance.cfg'), 'utf8'), 'PreLaunchCommand') || '');
    return m && m[1];
  } catch { return null; }
}

function main(argv) {
  let fix = false, cache, cfg = path.join(STABLE_INSTANCE, 'instance.cfg');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--fix') fix = true;
    else if (argv[i] === '--cache' && argv[i + 1]) cache = argv[++i];
    else if (argv[i] === '--cfg' && argv[i + 1]) cfg = argv[++i];
    else throw Error('Usage: stable_prelaunch_check.cjs [--fix] [--cache <dir>] [--cfg <instance.cfg>]');
  }
  const text = fs.readFileSync(cfg, 'utf8');
  const problems = stablePrelaunchProblems(text);
  if (!problems.length) { console.log(`OK Stable prelaunch runs ${SCRIPT}`); return 0; }
  for (const p of problems) console.log('PROBLEM ' + p);
  if (!fix) return 1;
  fs.writeFileSync(cfg, fixStableCfg(text, cache || localCache() || DEFAULT_CACHE));
  console.log(`FIXED ${cfg}. MultiMC must be closed while this is done, or it writes its in-memory (old) value back.`);
  return 0;
}
if (require.main === module) { try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 2; } }
module.exports = { stablePrelaunchProblems, fixStableCfg };
