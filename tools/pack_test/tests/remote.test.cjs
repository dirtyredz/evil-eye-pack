'use strict';
// ANU target: incremental sync decisions, the heartbeat dir lock, and the remote command encoding.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildManifest, diffManifest, MANIFEST } = require('../remote/sync.cjs');
const { encode, q } = require('../remote/ssh.cjs');
const { lockScript } = require('../remote/anu.cjs');
const { refreshDirLock, releaseDirLock } = require('../session/lock.cjs');

test('sync sends only new or changed files and deletes files gone locally', () => {
  const local = { 'mods/a.jar': '10:1', 'mods/b.jar': '20:2', 'config/c.toml': '3:3' };
  const remote = { 'mods/a.jar': '10:1', 'mods/b.jar': '20:1', 'mods/old.jar': '5:5' };
  assert.deepEqual(diffManifest(local, remote), { changed: ['config/c.toml', 'mods/b.jar'], removed: ['mods/old.jar'] });
  assert.deepEqual(diffManifest(local, {}).changed.length, 3, 'first sync sends everything');
  assert.deepEqual(diffManifest(local, local), { changed: [], removed: [] });
});

test('buildManifest walks the tree with forward slashes, skips its own manifest and skipped paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'packtest-sync-'));
  try {
    fs.mkdirSync(path.join(root, 'mods'));
    fs.mkdirSync(path.join(root, 'logs'));
    fs.writeFileSync(path.join(root, 'mods/a.jar'), 'abc');
    fs.writeFileSync(path.join(root, 'logs/x.log'), 'x');
    fs.writeFileSync(path.join(root, MANIFEST), '{}');
    const m = buildManifest(root, (r) => r.startsWith('logs'));
    assert.deepEqual(Object.keys(m), ['mods/a.jar']);
    assert.match(m['mods/a.jar'], /^3:\d+$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('heartbeat dir lock: same owner refreshes, another owner is refused, only the owner releases', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'packtest-dirlock-'));
  const dir = path.join(root, 'lock');
  try {
    refreshDirLock(dir, 'run-a');
    const first = JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8'));
    assert.equal(first.owner, 'run-a');
    refreshDirLock(dir, 'run-a');
    assert.throws(() => refreshDirLock(dir, 'run-b'), /held by run-a/);
    assert.equal(releaseDirLock(dir, 'run-b'), false);
    assert.ok(fs.existsSync(dir));
    assert.equal(releaseDirLock(dir, 'run-a'), true);
    assert.ok(!fs.existsSync(dir));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('remote PowerShell is UTF-16LE base64 and literals are single-quote escaped', () => {
  const decoded = Buffer.from(encode("Write-Output 'x'"), 'base64').toString('utf16le');
  assert.match(decoded, /\$ErrorActionPreference='Stop'/);
  assert.match(decoded, /Write-Output 'x'$/);
  assert.equal(q("it's"), "'it''s'");
});

test('the lock script waits for a live neighbour job and for our own fresh lock', () => {
  const s = lockScript('run-x');
  assert.match(s, /G:\\mods-ci\\lock/);
  assert.match(s, /BUSY neighbour job/);
  assert.match(s, /BUSY pack-test run/);
  assert.match(s, /owner = 'run-x'/);
});
