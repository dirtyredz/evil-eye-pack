'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { acquire, refreshDirLock, releaseDirLock } = require('../remote/lease/dir_lock.cjs');
const { scope } = require('../../server_smoke/procs.cjs');
const { EventEmitter } = require('node:events');

test('a stale claim cannot refresh or release a newer claim of the same run', () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.lease-test-'));
  const f = path.join(dir, 'owner.json');
  const newer = JSON.stringify({ owner: 'run', claimId: 'new', at: 123 });
  try {
    fs.writeFileSync(f, newer);
    assert.throws(() => refreshDirLock(dir, 'run', 'old'), /lock/);
    assert.equal(fs.readFileSync(f, 'utf8'), newer);
    assert.equal(releaseDirLock(dir, 'run', 'old'), false);
    assert.equal(fs.readFileSync(f, 'utf8'), newer);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('agent heartbeat ownership loss kills its children and exits 2 with an infrastructure error', async () => {
  let heartbeat;
  let refreshes = 0;
  const killed = [], statuses = [], exits = [];
  const owned = scope({ spawnImpl: () => Object.assign(new EventEmitter(), { pid: 123 }), killImpl: (pid) => killed.push(pid) });
  const job = { lock: 'lock', runId: 'old-run', claimId: 'old-claim' };
  const fakeProcess = Object.assign(new EventEmitter(), { argv: ['node', 'agent', 'job.json'], env: {}, pid: 10, exit: (code) => exits.push(code) });
  const modules = {
    'node:fs': {
      readFileSync: () => JSON.stringify(job),
      createWriteStream: () => ({ write() {}, end() {} }),
      writeFileSync: (f, body) => statuses.push(JSON.parse(body))
    },
    'node:path': path,
    '../../server_smoke/procs.cjs': { scope: () => owned },
    '../session/execute.cjs': { execute: () => { owned.start('fake-server', []); return new Promise(() => {}); } },
    './lease/dir_lock.cjs': {
      refreshDirLock: (dir, owner, claimId) => {
        assert.equal(claimId, 'old-claim');
        if (++refreshes > 1) throw new Error('lock held by newer-run');
      },
      releaseDirLock: () => false
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../remote/agent.cjs'), 'utf8'), {
    require: (name) => modules[name], process: fakeProcess,
    setInterval: (fn) => { heartbeat = fn; return 1; }, clearInterval() {}
  });
  assert.equal(owned.size, 1);
  heartbeat();
  await Promise.resolve();
  assert.deepEqual(killed, [123]);
  assert.deepEqual(exits, [2]);
  assert.equal(statuses.at(-1).state, 'error');
  assert.match(statuses.at(-1).error, /lock.*newer-run/);
  assert.equal(owned.cancelled, true);
});

test('each acquisition writes and returns a unique claim even for the same run', async () => {
  const scripts = [];
  const ssh = { must: async (s) => { scripts.push(s); return 'LOCKED'; } };
  const a = await acquire(ssh, 'run');
  const b = await acquire(ssh, 'run');
  assert.ok(a.claimId);
  assert.notEqual(a.claimId, b.claimId);
  assert.ok(scripts[0].includes(`claimId = '${a.claimId}'`));
  assert.ok(scripts[1].includes(`claimId = '${b.claimId}'`));
});

test('refresh never acquires a missing, unreadable or legacy lease', () => {
  const root = fs.mkdtempSync(path.join(__dirname, '.lease-test-'));
  const dir = path.join(root, 'lock');
  const f = path.join(dir, 'owner.json');
  try {
    assert.throws(() => refreshDirLock(dir, 'run', 'claim'));
    assert.equal(fs.existsSync(dir), false);
    fs.mkdirSync(dir);
    assert.throws(() => refreshDirLock(dir, 'run', 'claim'));
    assert.deepEqual(fs.readdirSync(dir), []);
    for (const body of ['{torn', JSON.stringify({ owner: 'run', at: 123 })]) {
      fs.writeFileSync(f, body);
      assert.throws(() => refreshDirLock(dir, 'run', 'claim'));
      assert.equal(fs.readFileSync(f, 'utf8'), body);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('takeover after refresh validation prevents the old atomic rename', () => {
  const root = fs.mkdtempSync(path.join(__dirname, '.lease-test-'));
  const dir = path.join(root, 'lock');
  const f = path.join(dir, 'owner.json');
  const newer = JSON.stringify({ owner: 'run', claimId: 'new', at: 456 });
  const rename = fs.renameSync;
  try {
    fs.mkdirSync(dir);
    fs.writeFileSync(f, JSON.stringify({ owner: 'run', claimId: 'old', at: 123 }));
    fs.renameSync = (from, to) => {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir);
      fs.writeFileSync(f, newer);
      return rename(from, to);
    };
    assert.throws(() => refreshDirLock(dir, 'run', 'old'), /ENOENT/);
    assert.equal(fs.readFileSync(f, 'utf8'), newer);
    assert.deepEqual(fs.readdirSync(dir), ['owner.json']);
  } finally { fs.renameSync = rename; fs.rmSync(root, { recursive: true, force: true }); }
});
