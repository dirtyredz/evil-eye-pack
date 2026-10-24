'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { tryLock, localLock } = require('../../session/lock.cjs');

function withLock(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-test-'));
  try { return fn(path.join(dir, 'sub', 'x.lock')); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;

test('tryLock creates the file with our pid and owner', () => withLock((f) => {
  assert.deepEqual(tryLock(f, { owner: 'me' }), { ok: true });
  const body = read(f);
  assert.equal(body.pid, process.pid);
  assert.equal(body.owner, 'me');
  assert.equal(body.host, os.hostname());
}));

test('a second tryLock sees the live holder', () => withLock((f) => {
  tryLock(f);
  const r = tryLock(f);
  assert.equal(r.ok, false);
  assert.equal(r.held.pid, process.pid);
}));

test('a lock from a dead pid on this host is taken over', () => withLock((f) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ pid: deadPid(), host: os.hostname(), at: Date.now() }));
  assert.equal(tryLock(f).ok, true);
  assert.equal(read(f).pid, process.pid);
}));

test('a lock older than staleMs is taken over even when its pid is alive', () => withLock((f) => {
  tryLock(f);
  assert.equal(tryLock(f, { staleMs: 1000, now: () => Date.now() + 5000 }).ok, true);
}));

test('a recent lock from another host is respected; a torn lock file is stale', () => withLock((f) => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ pid: deadPid(), host: 'some-other-box', at: Date.now() }));
  const r = tryLock(f);
  assert.equal(r.ok, false);
  assert.equal(r.held.host, 'some-other-box');
  fs.writeFileSync(f, '{torn');
  assert.equal(tryLock(f).ok, true);
}));

test('localLock throws when held and release removes only our own lock', () => withLock((f) => {
  const h = localLock(f);
  assert.throws(() => localLock(f), /locked by pid/);
  h.release();
  assert.equal(fs.existsSync(f), false);
  const mine = localLock(f);
  fs.writeFileSync(f, JSON.stringify({ pid: deadPid(), host: os.hostname(), at: Date.now() }));
  mine.release();
  assert.equal(fs.existsSync(f), true);
}));
