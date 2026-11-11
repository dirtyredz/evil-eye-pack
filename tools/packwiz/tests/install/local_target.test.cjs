'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../install/instance_targets.cjs');
const L = require('../../install/targets/local_target.cjs');

test('localTarget accepts only the real Local .minecraft', () => {
  assert.equal(T.localTarget(T.LOCAL), require('node:path').resolve(T.LOCAL));
  assert.throws(() => T.localTarget(T.STABLE), /Only Evil Eye Local/);
  assert.throws(() => T.localTarget(T.TRIAL), /Only Evil Eye Local/);
});

test('Local cfg is Stable cfg minus play history, renamed', () => {
  const out = L.localCfgFromStable('JavaPath=x\nlastLaunchTime=5\nname=Evil Eye (Stable)\ntotalTimePlayed=9\nlastTimePlayed=2\nJvmArgs=-Xa\n');
  assert.equal(out, 'JavaPath=x\nname=Evil Eye Local\nJvmArgs=-Xa\n');
});

test('Local prelaunch points at the main checkout script', () => {
  const cmd = L.localPreLaunchCommand('C:/c');
  assert.match(cmd, /C:\/Users\/dirty\/projects\/evil-eye-pack\/scripts\/instances\/local-instance\.ps1" -Cache "C:\/c"$/);
});
