'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../data_io/files.cjs');
const P = require('../pack_index.cjs');
const { renderMetafile } = require('../migration/repoint.cjs');
const { instanceCfgValue, setInstanceCfgValue, trialPreLaunchCommand, prepareFiles, writePack, trialInstance } = require('../trial_install.cjs');

function multimcBackslashUnescape(value) {
  return value.replace(/\\(.)/g, '$1');
}

test('Trial instance.cfg values use forward slashes and survive MultiMC unescaping', () => {
  const root = 'C:\\Users\\dirty\\projects\\.worktrees\\evil-eye-pack\\migration\\neoforge-1.21.1';
  const cache = 'C:\\Users\\dirty\\projects\\artifacts\\evil-eye-pack\\jobs\\2026-10-31-world-trial-final\\cache';
  const command = trialPreLaunchCommand(root, cache);
  const changed = setInstanceCfgValue('name=Trial\nPreLaunchCommand=old\niconKey=default\n', 'PreLaunchCommand', command);
  const value = changed.match(/^PreLaunchCommand=(.*)$/m)[1];
  assert.doesNotMatch(value, /\\/);
  assert.equal(multimcBackslashUnescape(value), value);
  assert.equal(value, 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:/Users/dirty/projects/.worktrees/evil-eye-pack/migration/neoforge-1.21.1/scripts/migration/trial-walkthrough.ps1" -Cache "C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-world-trial-final/cache"');
  assert.equal(changed, `name=Trial\nPreLaunchCommand=${value}\niconKey=default\n`);
  assert.equal(instanceCfgValue('C:\\one\\two'), 'C:/one/two');
});

test('Trial install path never waits for other JVMs', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../trial_install.cjs'), 'utf8');
  assert.doesNotMatch(source, /host_wait|waitForServer/);
});

test('offline trial indexes verified private bytes as ordinary installer-owned files', t => {
  const scratch = path.resolve(__dirname, '../../../.tmp');
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'trial-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('private jar fixture');
  const pin = { source: 'local', metafile: 'mods/private.pw.toml', filename: 'private.jar', name: 'Private', side: 'both', sha256: sha256(bytes), size: bytes.length };
  for (const d of ['mods', 'cache/mods', 'tools/packwiz/migration']) fs.mkdirSync(path.join(root, d), { recursive: true });
  const meta = renderMetafile(pin);
  fs.writeFileSync(path.join(root, pin.metafile), meta);
  fs.writeFileSync(path.join(root, 'cache/mods', pin.sha256 + '.jar'), bytes);
  fs.writeFileSync(path.join(root, 'tools/packwiz/migration/target-lock.json'), JSON.stringify({ entries: [{ target: pin }] }));
  const index = P.formatIndex({ hashFormat: 'sha256', files: [{ file: pin.metafile, hash: sha256(meta), metafile: true }] });
  fs.writeFileSync(path.join(root, 'index.toml'), index);
  fs.writeFileSync(path.join(root, 'pack.toml'), `[index]\nfile = "index.toml"\nhash-format = "sha256"\nhash = "${sha256(index)}"\n`);
  const files = prepareFiles(root, path.join(root, 'cache'));
  assert.equal(files.length, 1);
  assert.equal(files[0].file, 'mods/private.jar');
  const pack = writePack(root, path.join(root, 'overlay'), files);
  const installed = P.parseIndex(fs.readFileSync(path.join(path.dirname(pack), 'index.toml'), 'utf8'));
  assert.equal(installed.files[0].metafile, false);
  assert.equal(installed.files[0].hash, sha256(bytes));
  assert.deepEqual(fs.readFileSync(path.join(path.dirname(pack), 'mods/private.jar')), bytes);
  assert.equal(fs.readFileSync(path.join(root, pin.metafile), 'utf8'), meta);
  fs.writeFileSync(path.join(root, 'cache/mods', pin.sha256 + '.jar'), 'corrupt');
  assert.throws(() => prepareFiles(root, path.join(root, 'cache')), /differs from lock/);
  fs.writeFileSync(path.join(root, 'cache/mods', pin.sha256 + '.jar'), bytes);
  fs.appendFileSync(path.join(root, pin.metafile), '\n');
  assert.throws(() => prepareFiles(root, path.join(root, 'cache')), /Stale index/);
});

test('trial destination rejects Stable, Local and other instances', () => {
  for (const name of ['Evil Eye Stable', 'Evil Eye Local', 'Other Trial']) {
    assert.throws(() => trialInstance(`C:/Users/dirty/MultiMC/instances/${name}/.minecraft`), /Only Evil Eye NeoForge Trial/);
  }
});
