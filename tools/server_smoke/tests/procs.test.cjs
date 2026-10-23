'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { scope } = require('../procs.cjs');

// Fake spawn: records every call and hands back an EventEmitter child.
function fakes() {
  const calls = [];
  const children = [];
  const killed = [];
  let pid = 100;
  const spawnImpl = (exe, args, opts) => {
    const c = Object.assign(new EventEmitter(), { pid: ++pid, stdout: new PassThrough(), stderr: new PassThrough() });
    calls.push({ exe, args, opts });
    children.push(c);
    return c;
  };
  const killImpl = (p) => { killed.push(p); };
  return { calls, children, killed, spawnImpl, killImpl };
}

test('start tracks the child and forgets it on exit', () => {
  const f = fakes();
  const s = scope(f);
  const c = s.start('x', []);
  assert.equal(s.size, 1);
  c.emit('exit', 0);
  assert.equal(s.size, 0);
});

test('every spawn is hidden and shell-free', async () => {
  const f = fakes();
  const s = scope(f);
  s.start('x', [], { shell: true, windowsHide: false });
  const r = s.run('y', []);
  f.children[1].emit('close', 0);
  await r;
  for (const c of f.calls) { assert.equal(c.opts.windowsHide, true); assert.equal(c.opts.shell, false); }
});

test('killAll kills each live pid, clears, then start throws', () => {
  const f = fakes();
  const s = scope(f);
  const a = s.start('a', []);
  s.start('b', []);
  a.emit('exit', 0);
  const pids = s.killAll();
  assert.deepEqual(pids, [f.children[1].pid]);
  assert.deepEqual(f.killed, pids);
  assert.equal(s.size, 0);
  assert.equal(s.cancelled, true);
  assert.throws(() => s.start('c', []), /cancelled/);
});

test('killAll({cancel:false}) leaves the scope usable', () => {
  const f = fakes();
  const s = scope(f);
  s.start('a', []);
  s.killAll({ cancel: false });
  assert.equal(s.cancelled, false);
  assert.doesNotThrow(() => s.start('b', []));
});

test('run collects stdout and stderr and resolves on close', async () => {
  const f = fakes();
  const s = scope(f);
  const r = s.run('x', []);
  const c = f.children[0];
  setTimeout(() => { c.stdout.write('out;'); c.stderr.write('err;'); }, 5);
  setTimeout(() => c.emit('close', 7), 20);
  assert.deepEqual(await r, { code: 7, out: 'out;err;' });
});

test('run on a cancelled scope resolves code -1 instead of throwing', async () => {
  const s = scope(fakes());
  s.killAll();
  assert.equal((await s.run('x', [])).code, -1);
});

test('run with timeoutMs kills the pid and reports timedOut', async () => {
  const f = fakes();
  const s = scope({ spawnImpl: f.spawnImpl, killImpl: (p) => { f.killed.push(p); setImmediate(() => f.children[0].emit('close', 1)); } });
  const r = await s.run('x', [], { timeoutMs: 20 });
  assert.deepEqual(f.killed, [f.children[0].pid]);
  assert.equal(r.code, -1);
  assert.equal(r.timedOut, true);
});

test('real process: run resolves code 0 with its output', async () => {
  const r = await scope().run(process.execPath, ['-e', 'console.log("hi")']);
  assert.equal(r.code, 0);
  assert.match(r.out, /hi/);
});
