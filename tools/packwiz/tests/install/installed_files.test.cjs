'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../../data_io/files.cjs');
const { previewPackFiles, restorePackFiles, driftBackupDirectory, DRIFT_BACKUP_LIMIT } = require('../../install/installed_files.cjs');

function fixture(t) {
  const scratch = path.resolve(__dirname, '../../../../.tmp');
  fs.mkdirSync(scratch, { recursive: true });
  const root = fs.mkdtempSync(path.join(scratch, 'installed-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const instance = path.join(root, 'instance');
  fs.mkdirSync(instance);
  const files = [
    { file: 'managed', bytes: Buffer.from('shipped') },
    { file: 'missing', bytes: Buffer.from('new') },
    { file: 'personal', bytes: Buffer.from('default'), preserve: true },
    { file: 'mod.jar', bytes: Buffer.from('jar'), sourceMetafile: true },
    { file: 'unchanged', bytes: Buffer.from('same') },
  ].map(f => ({ ...f, hash: sha256(f.bytes) }));
  for (const f of files) if (f.file !== 'missing') fs.writeFileSync(path.join(instance, f.file), f.file === 'unchanged' ? f.bytes : 'drift');
  return { root, instance, files };
}

test('dry-run lists changed/missing plain files without touching bytes, history or mtimes', t => {
  const { root, instance, files } = fixture(t);
  const before = fs.readdirSync(instance).map(n => [n, fs.readFileSync(path.join(instance, n)), fs.statSync(path.join(instance, n)).mtimeMs]);
  const messages = [];
  assert.deepEqual(previewPackFiles(instance, files, m => messages.push(m)), ['managed', 'missing']);
  assert.deepEqual(messages, ['Would restore pack-owned file: managed', 'Would restore pack-owned file: missing']);
  assert.deepEqual(fs.readdirSync(root), ['instance']);
  assert.deepEqual(fs.readdirSync(instance).map(n => [n, fs.readFileSync(path.join(instance, n)), fs.statSync(path.join(instance, n)).mtimeMs]), before);
});

test('retention is bounded per instance and consecutive repairs warn until a clean run', t => {
  const { root, instance, files } = fixture(t);
  const history = driftBackupDirectory(instance, root);
  const other = path.join(root, 'other');
  fs.mkdirSync(other);
  const otherHistory = driftBackupDirectory(other, root);
  fs.mkdirSync(otherHistory, { recursive: true });
  fs.writeFileSync(path.join(otherHistory, 'sentinel'), 'untouched');
  for (let i = 0; i < DRIFT_BACKUP_LIMIT + 3; i++) {
    fs.writeFileSync(path.join(instance, 'managed'), 'drift ' + i);
    const messages = [];
    restorePackFiles(instance, files, root, m => messages.push(m));
    const generations = fs.readdirSync(history).filter(n => n.startsWith('run-'));
    assert.equal(generations.length, Math.min(i + 1, DRIFT_BACKUP_LIMIT));
    assert.ok(generations.some(n => fs.readFileSync(path.join(history, n, 'managed'), 'utf8') === 'drift ' + i));
    assert.deepEqual(generations.sort().map(n => fs.readFileSync(path.join(history, n, 'managed'), 'utf8')),
      Array.from({ length: Math.min(i + 1, DRIFT_BACKUP_LIMIT) }, (_, offset) => 'drift ' + (Math.max(0, i + 1 - DRIFT_BACKUP_LIMIT) + offset)));
    assert.equal(messages.some(m => m.includes('consecutive runs: managed')), i > 0);
  }
  assert.equal(fs.readFileSync(path.join(otherHistory, 'sentinel'), 'utf8'), 'untouched');
  restorePackFiles(instance, files, root, () => {});
  fs.writeFileSync(path.join(instance, 'managed'), 'again');
  const messages = [];
  restorePackFiles(instance, files, root, m => messages.push(m));
  assert.ok(!messages.some(m => m.includes('consecutive')));
  assert.equal(fs.readFileSync(path.join(instance, 'personal'), 'utf8'), 'drift');
  assert.equal(fs.readFileSync(path.join(instance, 'mod.jar'), 'utf8'), 'drift');
});

test('a linked backup directory is refused without writing through it', t => {
  const { root, instance, files } = fixture(t);
  const history = driftBackupDirectory(instance, root);
  const outside = path.join(root, 'outside');
  fs.mkdirSync(outside);
  fs.mkdirSync(path.dirname(history), { recursive: true });
  fs.symlinkSync(outside, history, 'junction');
  assert.throws(() => restorePackFiles(instance, files, root), /Symlink\/junction refused/);
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.readFileSync(path.join(instance, 'managed'), 'utf8'), 'drift');
});
