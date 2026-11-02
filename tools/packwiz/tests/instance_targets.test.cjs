'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const T = require('../install/instance_targets.cjs');

const I = 'C:/Users/dirty/MultiMC/instances';

test('kinds are decided by instance name; only the exact path is the real Stable', () => {
  assert.equal(T.instanceKind(`${I}/Evil Eye Stable`), 'stable');
  assert.equal(T.instanceKind(`${I}/Evil Eye Local/.minecraft`), 'local');
  assert.equal(T.instanceKind(`${I}/Evil Eye NeoForge Trial`), 'trial');
  assert.equal(T.instanceKind('C:/rehearsal/copy'), 'other');
  assert.equal(T.isRealStable(`${I}/Evil Eye Stable`), true);
  assert.equal(T.isRealStable(T.STABLE), true);
  assert.equal(T.isRealStable('C:/rehearsal/Evil Eye Stable'), false);
});

test('Local and Trial are refused as Stable targets and Stable/Local as pin targets', () => {
  assert.throws(() => T.assertNotLocalOrTrial(`${I}/Evil Eye Local`), /never targets/);
  assert.throws(() => T.assertNotLocalOrTrial(`${I}/Evil Eye NeoForge Trial/.minecraft`), /never targets/);
  assert.doesNotThrow(() => T.assertNotLocalOrTrial(`${I}/Evil Eye Stable`));
  assert.throws(() => T.assertPinTarget(`${I}/Evil Eye Stable/.minecraft`), /Private pins/);
  assert.throws(() => T.assertPinTarget(`${I}/Evil Eye Local/.minecraft`), /Private pins/);
  assert.doesNotThrow(() => T.assertPinTarget(T.TRIAL));
});

test('stableTarget is an allowlist: real Stable and outside rehearsal copies only', () => {
  assert.equal(T.stableTarget(T.STABLE), path.resolve(T.STABLE));
  assert.doesNotThrow(() => T.stableTarget('C:/rehearsal/Evil Eye Stable/.minecraft'));
  assert.doesNotThrow(() => T.stableTarget('C:/rehearsal/anything/.minecraft'));
  assert.throws(() => T.stableTarget(`${I}/Some Other Pack/.minecraft`), /real Evil Eye Stable/);
  assert.throws(() => T.stableTarget(`${I}/Evil Eye Stable Copy/.minecraft`), /real Evil Eye Stable/);
  assert.throws(() => T.stableTarget(`${I}/Evil Eye Local/.minecraft`), /never targets/);
  assert.throws(() => T.stableTarget(T.TRIAL), /never targets/);
  assert.throws(() => T.stableTarget('C:/rehearsal/Evil Eye Local/.minecraft'), /never targets/);
  assert.throws(() => T.stableTarget(`${I}/Evil Eye Stable`), /.minecraft/);
});

test('allowedAsStable mirrors the allowlist for folders and .minecraft', () => {
  assert.equal(T.allowedAsStable(`${I}/Evil Eye Stable`), true);
  assert.equal(T.allowedAsStable(T.STABLE), true);
  assert.equal(T.allowedAsStable('C:/rehearsal/copy'), true);
  assert.equal(T.allowedAsStable(`${I}/Other Pack`), false);
  assert.equal(T.allowedAsStable(`${I}/Evil Eye Local`), false);
});

test('stable CLI prints the real Stable instance', () => {
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../install/instance_targets.cjs'), 'stable'], { encoding: 'utf8' });
  assert.equal(r.stdout.trim(), T.STABLE_INSTANCE);
});

test('classify CLI is the PowerShell entry point', () => {
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../install/instance_targets.cjs'), 'classify', `${I}/Evil Eye Local`], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), { kind: 'local', realStable: false, forbiddenForStable: true, allowedAsStable: false });
});
