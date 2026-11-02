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

test('classify CLI is the PowerShell entry point', () => {
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../install/instance_targets.cjs'), 'classify', `${I}/Evil Eye Local`], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), { kind: 'local', realStable: false, forbiddenForStable: true });
});
