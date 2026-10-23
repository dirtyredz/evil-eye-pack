'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const procs = require('../procs.cjs');
const { boot, lineWatcher } = require('../boot.cjs');

const DONE = 'Done (1.5s)! For help, type "help"\n';

// steps: [atMs after start, fn(child)]. opts.ignoreStop: child does not exit on 'stop'.
async function run(o, steps, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-test-'));
  const clock = { t: 1000 };
  const start = clock.t;
  const writes = [];
  const killedTrees = [];
  const spawned = [];
  let main;
  const mk = () => Object.assign(new EventEmitter(), { pid: 500 + spawned.length, stdout: new PassThrough(), stderr: new PassThrough() });
  const spawnImpl = (exe, args) => {
    spawned.push(exe);
    const c = mk();
    if (exe !== 'java') {
      setImmediate(() => { c.stdout.write('thread dump'); setImmediate(() => c.emit('close', 0)); });
      return c;
    }
    c.stdin = new Writable({ write(chunk, _e, cb) {
      writes.push(chunk.toString()); cb();
      if (chunk.toString() === 'stop\n' && !opts.ignoreStop) c.emit('exit', 0);
    } });
    main = c;
    return c;
  };
  const pending = steps.map(([at, fn]) => ({ at: start + at, fn, done: false }));
  const wait = async (ms) => {
    clock.t += ms;
    for (const s of pending) if (!s.done && clock.t >= s.at) { s.done = true; s.fn(main); }
    await new Promise((r) => setImmediate(r));
  };
  const deps = {
    scope: procs.scope({ spawnImpl, killImpl: () => {} }), java: 'java', jcmd: 'jcmd', forge: 'x',
    now: () => clock.t, wait, readCpu: opts.readCpu || (async () => clock.t / 1000),
    setPriority: async () => ({ ok: true, skipped: true }),
    killTree: (pid) => { killedTrees.push(pid); if (opts.exitOnKill) main.emit('exit', 1); },
  };
  const base = { sample: 1, silent: 3600, timeout: 7200 };
  try {
    const result = await boot(dir, { ...base, ...o }, () => {}, deps);
    return { result, writes, killedTrees, spawned, dir, consoleLog: fs.readFileSync(path.join(dir, 'console.log'), 'utf8'), dumpExists: fs.existsSync(path.join(dir, 'stall-threads.txt')) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const out = (s) => (c) => c.stdout.write(s);

test('lineWatcher sees a marker split across chunks', () => {
  const w = lineWatcher(/Done \(([\d.]+)s\)!/);
  assert.equal(w('Done (12.3'), false);
  assert.equal(w('4s)! For help'), true);
  assert.equal(lineWatcher(/x/)('abc\n'), false);
});

test('Done split across two stdout chunks is detected', async () => {
  const r = await run({}, [[1000, out('Done (12.3')], [1500, out('4s)! For help\n')]]);
  assert.notEqual(r.result.wallSeconds, null);
});

test('without o.complete, boot stops after Done', async () => {
  const r = await run({}, [[1000, out(DONE)]]);
  assert.deepEqual(r.writes, ['stop\n']);
  assert.equal(r.result.killed, false);
  assert.equal(r.result.completed, null);
  assert.equal(r.result.wallSeconds, 1);
});

test('Done before completion: completed only after both', async () => {
  let ok = false;
  const r = await run({ complete: () => ok }, [[1000, out(DONE)], [5000, () => { ok = true; }]]);
  assert.equal(r.result.completed, true);
  assert.equal(r.result.wallSeconds, 1);
  assert.ok(r.result.totalWallSeconds >= 5);
});

test('completion before Done still waits for Done', async () => {
  const r = await run({ complete: () => true }, [[4000, out(DONE)]]);
  assert.equal(r.result.completed, true);
  assert.equal(r.result.wallSeconds, 4);
});

test('completion never seen: completeTimedOut, stop still sent', async () => {
  const r = await run({ complete: () => false, completeTimeout: 3 }, [[1000, out(DONE)]]);
  assert.equal(r.result.completeTimedOut, true);
  assert.equal(r.result.completed, false);
  assert.deepEqual(r.writes, ['stop\n']);
});

test('exit after Done before completion: exitedAfterDone, no earlyExit', async () => {
  const r = await run({ complete: () => false, completeTimeout: 60 }, [[1000, out(DONE)], [2000, (c) => c.emit('exit', 0)]]);
  assert.equal(r.result.completed, false);
  assert.equal(r.result.exitedAfterDone, 0);
  assert.equal(r.result.earlyExit, null);
});

test('exit before Done reports earlyExit', async () => {
  const r = await run({}, [[1000, (c) => c.emit('exit', 3)]]);
  assert.equal(r.result.earlyExit, 3);
  assert.deepEqual(r.writes, []);
});

test('silent watchdog: thread dump, tree kill, no stop', async () => {
  const r = await run({ silent: 5 }, [], { readCpu: async () => 5, exitOnKill: true });
  assert.equal(r.result.timedOut, true);
  assert.equal(r.result.stopReason, 'silent');
  assert.ok(r.spawned.includes('jcmd'));
  assert.equal(r.dumpExists, true);
  assert.equal(r.killedTrees.length, 1);
  assert.deepEqual(r.writes, []);
});

test('stop ignored: tree killed after the grace period', async () => {
  const r = await run({}, [[1000, out(DONE)]], { ignoreStop: true });
  assert.deepEqual(r.writes, ['stop\n']);
  assert.equal(r.result.killed, true);
  assert.equal(r.killedTrees.length, 1);
});

test('console.log holds the child output', async () => {
  const r = await run({}, [[500, out('hello\n')], [1000, out(DONE)]]);
  assert.match(r.consoleLog, /hello/);
  assert.match(r.consoleLog, /Done \(1\.5s\)!/);
});
