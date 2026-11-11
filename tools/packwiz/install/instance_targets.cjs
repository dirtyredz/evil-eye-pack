'use strict';
// The one authority for which MultiMC instance is which. Stable is the real daily-driver
// instance; Local and Trial must never be touched by the Stable cutover, rollback or prelaunch,
// and Stable and Local must never receive Trial's private pins. Node installers call these
// functions; PowerShell (scripts/migration/cutover-lib.ps1) calls `classify` below.
//   node tools/packwiz/install/instance_targets.cjs classify <instance folder or .minecraft>
//   node tools/packwiz/install/instance_targets.cjs stable     (prints the real Stable instance folder)
const path = require('node:path');
const fs = require('node:fs');
const { noLinks } = require('../../data_io/path_guard.cjs');
const { INSTANCES, MAIN_CHECKOUT } = require('../../runtime_env/env.cjs').FIXED;

const STABLE_INSTANCE = INSTANCES + '/Evil Eye Stable';
const TRIAL_INSTANCE = INSTANCES + '/Evil Eye NeoForge Trial';
const LOCAL_INSTANCE = INSTANCES + '/Evil Eye Local';
const STABLE = STABLE_INSTANCE + '/.minecraft';
const TRIAL = TRIAL_INSTANCE + '/.minecraft';
const LOCAL = LOCAL_INSTANCE + '/.minecraft';
const NAMES = { local: 'evil eye local', trial: 'evil eye neoforge trial', stable: 'evil eye stable' };

// Resolve aliases through the deepest existing ancestor, including future descendants.
function canonical(p) {
  let current = path.resolve(p);
  const tail = [];
  for (;;) {
    try { return path.join(fs.realpathSync.native(current), ...tail); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // A dangling junction is not a missing directory: fail closed.
      let exists = false;
      try { fs.lstatSync(current); exists = true; }
      catch (statError) { if (statError.code !== 'ENOENT') throw statError; }
      if (exists) throw error;
      const parent = path.dirname(current);
      if (parent === current) return path.join(current, ...tail);
      tail.unshift(path.basename(current)); current = parent;
    }
  }
}
const slash = p => canonical(p).split(path.sep).join('/');
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

const insideInstances = p => (slash(p).toLowerCase() + '/').startsWith(slash(INSTANCES).toLowerCase() + '/');

// Allowlist: the real Stable .minecraft, or a rehearsal copy OUTSIDE the MultiMC instances folder.
// Any other MultiMC instance (and Local/Trial, or copies of them) is refused.
function stableTarget(instance) {
  const resolved = path.resolve(instance);
  if (path.basename(resolved) !== '.minecraft') throw Error('Target must be an instance .minecraft folder');
  assertNotLocalOrTrial(resolved);
  if (!same(resolved, STABLE) && insideInstances(resolved)) throw Error('Stable target must be the real Evil Eye Stable instance or a copy outside the MultiMC instances folder');
  noLinks(resolved);
  return resolved;
}

function trialTarget(instance) {
  if (!same(instance, TRIAL)) throw Error('Only Evil Eye NeoForge Trial is allowed');
  noLinks(instance);
  return path.resolve(instance);
}

function localTarget(instance) {
  if (!same(instance, LOCAL)) throw Error('Only Evil Eye Local is allowed');
  noLinks(instance);
  return path.resolve(instance);
}

// Private pins must never install into Stable or Local.
function assertPinTarget(instance) {
  const kind = instanceKind(instance);
  if (kind === 'stable' || kind === 'local') throw Error('Private pins must never install into Stable or Local');
}

// Canonical form of the stableTarget allowlist, for an instance folder or its .minecraft.
function allowedAsStable(p) {
  const kind = instanceKind(p);
  if (kind === 'local' || kind === 'trial') return false;
  return isRealStable(p) || !insideInstances(p);
}

function classify(p) {
  const kind = instanceKind(p);
  return { kind, realStable: isRealStable(p), forbiddenForStable: kind === 'local' || kind === 'trial', allowedAsStable: allowedAsStable(p) };
}

if (require.main === module) {
  const [cmd, target] = process.argv.slice(2);
  if (cmd === 'stable') console.log(STABLE_INSTANCE);
  else if (cmd !== 'classify' || !target) { console.error('usage: instance_targets.cjs classify <path> | stable'); process.exitCode = 3; }
  else console.log(JSON.stringify(classify(target)));
}
module.exports = { STABLE, TRIAL, LOCAL, STABLE_INSTANCE, TRIAL_INSTANCE, LOCAL_INSTANCE, MAIN_CHECKOUT, localTarget, instanceKind, isRealStable, assertNotLocalOrTrial, stableTarget, trialTarget, assertPinTarget, allowedAsStable, classify };
