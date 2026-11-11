'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { instanceCfgGet, instanceCfgValue, setInstanceCfgValue } = require('../../install/instance_cfg.cjs');

test('instance.cfg reads exact keys and distinguishes empty from missing', () => {
  const cfg = 'name=Stable\r\nPreLaunchCommand=\r\n';
  assert.equal(instanceCfgGet(cfg, 'name'), 'Stable');
  assert.equal(instanceCfgGet(cfg, 'PreLaunchCommand'), '');
  assert.equal(instanceCfgGet(cfg, 'LaunchCommand'), undefined);
});

test('instance.cfg mutation preserves surrounding keys and existing line endings', () => {
  for (const eol of ['\n', '\r\n']) {
    const cfg = ['name=Stable', 'PreLaunchCommand=old', 'iconKey=default', ''].join(eol);
    const updated = setInstanceCfgValue(cfg, 'PreLaunchCommand', 'C:\\pack\\launch.ps1');
    assert.equal(updated, ['name=Stable', 'PreLaunchCommand=C:/pack/launch.ps1', 'iconKey=default', ''].join(eol));
    assert.equal(setInstanceCfgValue(updated, 'OverrideCommands', 'true'), updated + 'OverrideCommands=true' + eol);
  }
  assert.equal(setInstanceCfgValue('', 'name', 'Local'), 'name=Local\n');
  assert.equal(setInstanceCfgValue('name=Local', 'OverrideCommands', 'true'), 'name=Local\nOverrideCommands=true\n');
});

test('instance.cfg operations reject unsafe keys and multiline or non-string values', () => {
  for (const key of ['name.*', 'name\n', '1name', '']) {
    assert.throws(() => instanceCfgGet('', key), /Unsafe instance.cfg key/);
    assert.throws(() => setInstanceCfgValue('', key, 'value'), /Unsafe instance.cfg key/);
  }
  for (const value of ['one\ntwo', 'one\rtwo', null, 12]) {
    assert.throws(() => instanceCfgValue(value), /Unsafe instance.cfg value/);
    assert.throws(() => setInstanceCfgValue('', 'name', value), /Unsafe instance.cfg value/);
  }
});
