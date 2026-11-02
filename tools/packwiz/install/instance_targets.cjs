'use strict';
// The one authority for which MultiMC instance is which. Stable is the real daily-driver
// instance; Local and Trial must never be touched by the Stable cutover, rollback or prelaunch,
// and Stable and Local must never receive Trial's private pins. Node installers call these
// functions; PowerShell (scripts/migration/cutover-lib.ps1) calls `classify` below.
//   node tools/packwiz/install/instance_targets.cjs classify <instance folder or .minecraft>
const path = require('node:path');
const { noLinks } = require('../../data_io/path_guard.cjs');

const INSTANCES = 'C:/Users/dirty/MultiMC/instances';
const STABLE_INSTANCE = INSTANCES + '/Evil Eye Stable';
const TRIAL_INSTANCE = INSTANCES + '/Evil Eye NeoForge Trial';
const STABLE = STABLE_INSTANCE + '/.minecraft';
const TRIAL = TRIAL_INSTANCE + '/.minecraft';
const NAMES = { local: 'evil eye local', trial: 'evil eye neoforge trial', stable: 'evil eye stable' };

const slash = p => path.resolve(p).split(path.sep).join('/');
const same = (a, b) => slash(a).toLowerCase() === slash(b).toLowerCase();

// Name-based kind: 'local' and 'trial' match any path segment containing the instance name (so a
// copy of either is refused too); 'stable' is a segment named exactly Evil Eye Stable.
function instanceKind(p) {
  const segments = slash(p).toLowerCase().split('/');
  if (segments.some(s => s.includes(NAMES.trial))) return 'trial';
  if (segments.some(s => s.includes(NAMES.local))) return 'local';
  if (segments.includes(NAMES.stable)) return 'stable';
  return 'other';
}

// True only for the real Stable instance (folder or .minecraft), not a rehearsal copy of it.
function isRealStable(p) { return same(p, STABLE_INSTANCE) || same(p, STABLE); }

function assertNotLocalOrTrial(p, what = 'Cutover') {
  const kind = instanceKind(p);
  if (kind === 'local' || kind === 'trial') throw Error(`${what} never targets Evil Eye Local or the NeoForge Trial instance`);
}

// Only the real Stable instance (or an explicit copy of it, for rehearsals) is a valid Stable target.
function stableTarget(instance) {
  const resolved = path.resolve(instance);
  if (path.basename(resolved) !== '.minecraft') throw Error('Target must be an instance .minecraft folder');
  assertNotLocalOrTrial(resolved);
  noLinks(resolved);
  return resolved;
}

function trialTarget(instance) {
  if (!same(instance, TRIAL)) throw Error('Only Evil Eye NeoForge Trial is allowed');
  noLinks(instance);
  return path.resolve(instance);
}

// Private pins must never install into Stable or Local.
function assertPinTarget(instance) {
  const kind = instanceKind(instance);
  if (kind === 'stable' || kind === 'local') throw Error('Private pins must never install into Stable or Local');
}

function classify(p) {
  const kind = instanceKind(p);
  return { kind, realStable: isRealStable(p), forbiddenForStable: kind === 'local' || kind === 'trial' };
}

if (require.main === module) {
  const [cmd, target] = process.argv.slice(2);
  if (cmd !== 'classify' || !target) { console.error('usage: instance_targets.cjs classify <path>'); process.exitCode = 3; }
  else console.log(JSON.stringify(classify(target)));
}
module.exports = { STABLE, TRIAL, STABLE_INSTANCE, TRIAL_INSTANCE, instanceKind, isRealStable, assertNotLocalOrTrial, stableTarget, trialTarget, assertPinTarget, classify };
