'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startLease } = require('../remote/lease/lifecycle.cjs');
const { acquire, refreshDirLock, releaseDirLock } = require('../remote/lease/dir_lock.cjs');
const { scope } = require('../../server_smoke/procs.cjs');
const { EventEmitter } = require('node:events');

test('a stale claim cannot refresh or release a newer claim of the same run', () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.lease-test-'));
  const f = path.join(dir, 'owner.json');
  const newer = JSON.stringify({ owner: 'run', claimId: 'new', at: 123 });
  try {
    fs.writeFileSync(f, newer);
    assert.throws(() => refreshDirLock(dir, { runId: 'run', claimId: 'old' }), /lock/);
    assert.equal(fs.readFileSync(f, 'utf8'), newer);
    assert.equal(releaseDirLock(dir, { runId: 'run', claimId: 'old' }), false);
    assert.equal(fs.readFileSync(f, 'utf8'), newer);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('agent heartbeat ownership loss kills its children and exits 2 with an infrastructure error', async () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.lease-test-'));
  const f = path.join(dir, 'owner.json');
  let heartbeat;
  const killed = [], statuses = [], exits = [], cleared = [];
  const owned = scope({ spawnImpl: () => Object.assign(new EventEmitter(), { pid: 123 }), killImpl: (pid) => killed.push(pid) });
  const job = { lock: dir, lease: { runId: 'old-run', claimId: 'old-claim' } };
  const signals = new EventEmitter();
  const newer = JSON.stringify({ owner: 'newer-run', claimId: 'new-claim' });
  fs.writeFileSync(f, JSON.stringify({ owner: 'old-run', claimId: 'old-claim' }));
  const lease = startLease({ job, scope: owned, status: (s) => statuses.push(s), log() {}, exit: (code) => exits.push(code), signals,
    timers: { setInterval: (fn, ms) => { assert.equal(ms, 30000); heartbeat = fn; return 1; }, clearInterval: (id) => cleared.push(id) } });
  try {
    owned.start('fake-server', []);
    heartbeat();
    assert.equal(statuses.length, 0);
    // Mutating job metadata must not let this lifecycle adopt a replacement claim.
    job.lease = { runId: 'newer-run', claimId: 'new-claim' };
    fs.writeFileSync(f, newer);
    heartbeat();
    await Promise.resolve();
    assert.deepEqual(killed, [123]);
    assert.deepEqual(exits, [2]);
    assert.equal(statuses.at(-1).state, 'error');
    assert.match(statuses.at(-1).error, /lock.*newer-run/);
    assert.equal(owned.cancelled, true);
    assert.equal(fs.readFileSync(f, 'utf8'), newer);
    assert.deepEqual(cleared, [1]);
    assert.equal(signals.listenerCount('SIGINT'), 0);
    assert.equal(signals.listenerCount('SIGTERM'), 0);
    heartbeat();
    signals.emit('SIGINT');
    assert.deepEqual(exits, [2], 'loss remains terminal');
  } finally { lease.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('closing a lease clears heartbeat and signal hooks and releases only its claim', () => {
  const dir = fs.mkdtempSync(path.join(__dirname, '.lease-test-'));
  fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ owner: 'run', claimId: 'claim' }));
  const signals = new EventEmitter(), cleared = [];
  const lease = startLease({ job: { lock: dir, lease: { runId: 'run', claimId: 'claim' } }, scope: {}, status() {}, log() {}, signals,
    timers: { setInterval: () => 1, clearInterval: (id) => cleared.push(id) } });
  try {
    lease.close();
    lease.close();
    assert.deepEqual(cleared, [1]);
    assert.equal(signals.listenerCount('SIGINT'), 0);
    assert.equal(signals.listenerCount('SIGTERM'), 0);
    assert.equal(fs.existsSync(dir), false);
  } finally { lease.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('each acquisition writes and returns a unique claim even for the same run', async () => {
  const scripts = [];
  const ssh = { must: async (s) => { scripts.push(s); return 'LOCKED'; } };
  const a = await acquire(ssh, 'run');
  const b = await acquire(ssh, 'run');
  assert.equal(a.lease.runId, 'run');
  assert.ok(a.lease.claimId);
  assert.notEqual(a.lease.claimId, b.lease.claimId);
  assert.ok(scripts[0].includes(`claimId = '${a.lease.claimId}'`));
  assert.ok(scripts[1].includes(`claimId = '${b.lease.claimId}'`));
});

test('refresh never acquires a missing, unreadable or legacy lease', () => {
  const root = fs.mkdtempSync(path.join(__dirname, '.lease-test-'));
  const dir = path.join(root, 'lock');
  const f = path.join(dir, 'owner.json');
  try {
    assert.throws(() => refreshDirLock(dir, { runId: 'run', claimId: 'claim' }));
    assert.equal(fs.existsSync(dir), false);
    fs.mkdirSync(dir);
    assert.throws(() => refreshDirLock(dir, { runId: 'run', claimId: 'claim' }));
    assert.deepEqual(fs.readdirSync(dir), []);
    for (const body of ['{torn', JSON.stringify({ owner: 'run', at: 123 })]) {
      fs.writeFileSync(f, body);
      assert.throws(() => refreshDirLock(dir, { runId: 'run', claimId: 'claim' }));
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
    assert.throws(() => refreshDirLock(dir, { runId: 'run', claimId: 'old' }), /ENOENT/);
    assert.equal(fs.readFileSync(f, 'utf8'), newer);
    assert.deepEqual(fs.readdirSync(dir), ['owner.json']);
  } finally { fs.renameSync = rename; fs.rmSync(root, { recursive: true, force: true }); }
});
