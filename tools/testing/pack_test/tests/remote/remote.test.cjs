'use strict';
// ANU target: incremental sync decisions, the heartbeat dir lock, and the remote command encoding.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildManifest, diffManifest, fileLabel, MANIFEST } = require('../../remote/sync.cjs');
const { encode, q } = require('../../remote/ssh.cjs');
const { lockScript, refreshDirLock, releaseDirLock } = require('../../remote/lease/dir_lock.cjs');

test('sync sends only new or changed files and deletes files gone locally', () => {
  const local = { 'mods/a.jar': '10:1', 'mods/b.jar': '20:2', 'config/c.toml': '3:3' };
  const remote = { 'mods/a.jar': '10:1', 'mods/b.jar': '20:1', 'mods/old.jar': '5:5' };
  assert.deepEqual(diffManifest(local, remote), { changed: ['config/c.toml', 'mods/b.jar'], removed: ['mods/old.jar'] });
  assert.deepEqual(diffManifest(local, {}).changed.length, 3, 'first sync sends everything');
  assert.deepEqual(diffManifest(local, local), { changed: [], removed: [] });
});

test('sync file labels never carry a path separator (tools-testing/server_smoke broke the scp into the flat incoming dir)', () => {
  assert.equal(fileLabel('tools-testing/server_smoke'), 'tools-testing_server_smoke');
  assert.equal(fileLabel('stage'), 'stage');
  assert.doesNotMatch(fileLabel('tools-analysis\dedup'), /[\/]/);
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
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ owner: 'run-a', claimId: 'claim-a', at: Date.now() }));
    refreshDirLock(dir, { runId: 'run-a', claimId: 'claim-a' });
    const first = JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8'));
    assert.equal(first.owner, 'run-a');
    refreshDirLock(dir, { runId: 'run-a', claimId: 'claim-a' });
    assert.throws(() => refreshDirLock(dir, { runId: 'run-b', claimId: 'claim-b' }), /held by run-a/);
    assert.equal(releaseDirLock(dir, { runId: 'run-b', claimId: 'claim-b' }), false);
    assert.ok(fs.existsSync(dir));
    assert.equal(releaseDirLock(dir, { runId: 'run-a', claimId: 'claim-a' }), true);
    assert.ok(!fs.existsSync(dir));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('remote PowerShell is UTF-16LE base64 and literals are single-quote escaped', () => {
  const decoded = Buffer.from(encode("Write-Output 'x'"), 'base64').toString('utf16le');
  assert.match(decoded, /\$ErrorActionPreference='Stop'/);
  assert.match(decoded, /Write-Output 'x'$/);
  assert.equal(q("it's"), "'it''s'");
});

test('the lock script guards only our own runs and never looks at a neighbour', () => {
  const s = lockScript('run-x');
  assert.doesNotMatch(s, /mods-ci/);
  assert.doesNotMatch(s, /BUSY neighbour/);
  assert.match(s, /BUSY pack-test run/);
  assert.match(s, /owner = 'run-x'/);
});

test('every tools/ directory the ANU agent requires is in the synced CODE_DIRS (runtime_env was missing after the tools regroup and the agent died on start)', () => {
  const { CODE_DIRS } = require('../../remote/anu.cjs');
  const tools = path.resolve(__dirname, '../../../..');
  const seen = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/require\(\s*'(\.[^']+)'\s*\)/g)) {
      let p = path.resolve(path.dirname(f), m[1]);
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.js');
      for (const ext of ['', '.cjs', '.js']) if (fs.existsSync(p + ext) && fs.statSync(p + ext).isFile()) { walk(p + ext); break; }
    }
  };
  walk(path.join(tools, 'testing/pack_test/remote/agent.cjs'));
  const outside = [...seen].map((f) => path.relative(tools, f).split(path.sep).join('/'))
    .filter((rel) => !CODE_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`)));
  assert.deepEqual(outside, [], 'files the agent loads but ANU never receives');
});
