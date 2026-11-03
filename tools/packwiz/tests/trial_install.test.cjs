'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../data_io/files.cjs');
const P = require('../pack_index.cjs');
const { renderMetafile } = require('../migration/repoint.cjs');
const { instanceCfgValue, setInstanceCfgValue, prepareFiles, writePack, verifyInstalledFiles, restorePackFiles } = require('../install/install_pack.cjs');
const { trialPreLaunchCommand, trialInstance } = require('../install/trial_target.cjs');

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
  const source = fs.readFileSync(path.resolve(__dirname, '../install/install_pack.cjs'), 'utf8');
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
  assert.equal(files[0].sourceMetafile, true);
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

test('post-install verification ignores changed preserve files but rejects a tampered mod jar', t => {
  const instance = fs.mkdtempSync(path.join(path.resolve(__dirname, '../../../.tmp'), 'trial-verify-'));
  t.after(() => fs.rmSync(instance, { recursive: true, force: true }));
  const files = [
    { file: 'shaderpacks/example.zip.txt', bytes: Buffer.from('pack default'), preserve: true },
    { file: 'mods/private.jar', bytes: Buffer.from('private jar'), preserve: false },
    { file: 'config/managed.toml', bytes: Buffer.from('managed'), preserve: false },
  ].map(f => ({ ...f, hash: sha256(f.bytes) }));
  for (const f of files) {
    const dest = path.join(instance, f.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes);
  }
  fs.writeFileSync(path.join(instance, files[0].file), 'owner changed shader settings');
  assert.doesNotThrow(() => verifyInstalledFiles(instance, files));
  fs.writeFileSync(path.join(instance, files[1].file), 'tampered');
  assert.throws(() => verifyInstalledFiles(instance, files), /Installed artifact differs: mods\/private\.jar/);
});

test('game re-saves of strict configs are restored before verification', t => {
  const run = fs.mkdtempSync(path.join(path.resolve(__dirname, '../../../.tmp'), 'drift-test-'));
  t.after(() => fs.rmSync(run, { recursive: true, force: true }));
  const instance = path.join(run, 'instance');
  const files = [
    { file: 'config/evileye_tweaks-common.toml', bytes: Buffer.from('[sorting]\n\tenabled = true\n') },
    { file: 'config/modernui/client.toml', bytes: Buffer.from('zoom = true\n') },
    { file: 'config/personal.toml', bytes: Buffer.from('default'), preserve: true },
    { file: 'mods/private.jar', bytes: Buffer.from('jar'), sourceMetafile: true },
    { file: 'config/missing.toml', bytes: Buffer.from('missing') },
    { file: 'config/unchanged.toml', bytes: Buffer.from('unchanged') },
  ].map(f => ({ ...f, hash: sha256(f.bytes) }));
  const drift = ['[sorting]\nenabled=true\n', '# expanded defaults\nzoom=true\n', 'personal'];
  for (const [i, f] of files.entries()) {
    if (f.file === 'config/missing.toml') continue;
    const dest = path.join(instance, f.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, drift[i] || f.bytes);
  }
  const messages = [];
  assert.deepEqual(restorePackFiles(instance, files, run, line => messages.push(line)),
    [files[0].file, files[1].file, files[4].file]);
  assert.deepEqual(messages, [files[0], files[1], files[4]].map(f => 'Restored pack-owned file: ' + f.file));
  for (let i = 0; i < 2; i++) {
    assert.equal(fs.readFileSync(path.join(run, 'drift-backup', files[i].file), 'utf8'), drift[i]);
    assert.deepEqual(fs.readFileSync(path.join(instance, files[i].file)), files[i].bytes);
  }
  assert.equal(fs.readFileSync(path.join(instance, files[2].file), 'utf8'), 'personal');
  for (const f of files.slice(2)) assert.equal(fs.existsSync(path.join(run, 'drift-backup', f.file)), false);
  assert.deepEqual(restorePackFiles(instance, files, run), []);
  assert.doesNotThrow(() => verifyInstalledFiles(instance, files));
  fs.writeFileSync(path.join(instance, 'mods/private.jar'), 'tampered');
  assert.deepEqual(restorePackFiles(instance, files, run), []);
  assert.throws(() => verifyInstalledFiles(instance, files), /Installed artifact differs: mods\/private\.jar/);
});
