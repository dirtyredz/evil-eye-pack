'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { FIXED } = require('../../../runtime_env/env.cjs');
const { stablePreLaunchCommand } = require('../../install/targets/stable_target.cjs');
const { stablePrelaunchProblems, fixStableCfg } = require('../../install/checks/stable_prelaunch_check.cjs');

const BLANK = 'JavaPath=x\nOverrideCommands=true\nPreLaunchCommand=\nWrapperCommand=\n';

test('a blank PreLaunchCommand is a problem (the 2026-11-08 freeze)', () => {
  assert.match(stablePrelaunchProblems(BLANK).join('\n'), /PreLaunchCommand is empty/);
});

test('OverrideCommands off and a foreign command are problems', () => {
  assert.match(stablePrelaunchProblems('OverrideCommands=false\nPreLaunchCommand=x\n').join('\n'), /OverrideCommands/);
  assert.match(stablePrelaunchProblems('OverrideCommands=true\nPreLaunchCommand=echo hi\n').join('\n'), /does not run/);
});

test('generated real and rehearsal commands share the checker contract and require a cache', () => {
  for (const instance of [require('../../install/instance_targets.cjs').STABLE_INSTANCE, path.join(__dirname, 'rehearsal')]) {
    const command = stablePreLaunchCommand(FIXED.MAIN_CHECKOUT, FIXED.STABLE_CACHE, instance);
    const cfg = 'OverrideCommands=true\nPreLaunchCommand=' + command + '\n';
    assert.deepEqual(stablePrelaunchProblems(cfg), []);
    assert.match(stablePrelaunchProblems(cfg.replace(/ -Cache "[^"]+"/, '')).join('\n'), /no -Cache argument/);
  }
});

test('fix restores the exact Stable command and the repaired cfg passes', () => {
  const fixed = fixStableCfg(BLANK.replace('OverrideCommands=true', 'OverrideCommands=false'), 'C:/c');
  assert.deepEqual(stablePrelaunchProblems(fixed), []);
  assert.ok(fixed.includes('PreLaunchCommand=' + stablePreLaunchCommand(FIXED.MAIN_CHECKOUT, 'C:/c', require('../../install/instance_targets.cjs').STABLE_INSTANCE)));
  assert.match(fixed, /OverrideCommands=true/);
  assert.match(fixed, /WrapperCommand=\n$/);
});

test('--fix inserts missing keys and targets the rehearsal cfg folder', t => {
  const scratch = path.resolve(__dirname, '../../../../.tmp');
  fs.mkdirSync(scratch, { recursive: true });
  const copy = fs.mkdtempSync(path.join(scratch, 'prelaunch-copy-'));
  t.after(() => fs.rmSync(copy, { recursive: true, force: true }));
  const cfg = path.join(copy, 'instance.cfg');
  for (const text of [BLANK, 'name=Rehearsal\r\nWrapperCommand=']) {
    fs.writeFileSync(cfg, text);
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../../install/checks/stable_prelaunch_check.cjs'), '--cfg', cfg, '--fix'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const fixed = fs.readFileSync(cfg, 'utf8');
    assert.ok(fixed.includes(stablePreLaunchCommand(FIXED.MAIN_CHECKOUT, FIXED.STABLE_CACHE, copy)));
    const target = fixed.match(/-Instance "([^"]+)"/)[1];
    assert.equal(path.resolve(target), path.join(copy, '.minecraft'));
    assert.equal(require('../../install/instance_targets.cjs').stableTarget(target), path.join(copy, '.minecraft'));
    assert.deepEqual(stablePrelaunchProblems(fixed), []);
    assert.ok(fixed.includes(text.startsWith('name=') ? 'name=Rehearsal\r\nWrapperCommand=' : 'JavaPath=x\n'));
  }
});
