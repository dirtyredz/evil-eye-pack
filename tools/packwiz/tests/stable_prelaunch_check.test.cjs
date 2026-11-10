'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stablePrelaunchProblems, fixStableCfg } = require('../install/stable_prelaunch_check.cjs');

const BLANK = 'JavaPath=x\nOverrideCommands=true\nPreLaunchCommand=\nWrapperCommand=\n';

test('a blank PreLaunchCommand is a problem (the 2026-11-08 freeze)', () => {
  assert.match(stablePrelaunchProblems(BLANK).join('\n'), /PreLaunchCommand is empty/);
});

test('OverrideCommands off and a foreign command are problems', () => {
  assert.match(stablePrelaunchProblems('OverrideCommands=false\nPreLaunchCommand=x\n').join('\n'), /OverrideCommands/);
  assert.match(stablePrelaunchProblems('OverrideCommands=true\nPreLaunchCommand=echo hi\n').join('\n'), /does not run/);
});

test('fix restores the exact Stable command and the repaired cfg passes', () => {
  const fixed = fixStableCfg(BLANK.replace('OverrideCommands=true', 'OverrideCommands=false'), 'C:/c');
  assert.deepEqual(stablePrelaunchProblems(fixed), []);
  assert.match(fixed, /\nPreLaunchCommand=powershell\.exe -NoProfile -ExecutionPolicy Bypass -File "C:\/Users\/dirty\/projects\/evil-eye-pack\/scripts\/migration\/stable-prelaunch\.ps1" -Cache "C:\/c"\n/);
  assert.match(fixed, /OverrideCommands=true/);
  assert.match(fixed, /WrapperCommand=\n$/);
});
