'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { removeStaged, pruneStaged, withStaged } = require('../staged_dir.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-dir-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = path.join(root, 'run');
  const server = path.join(run, 'server');
  fs.mkdirSync(path.join(server, 'mods'), { recursive: true });
  fs.writeFileSync(path.join(server, 'mods/a.jar'), 'jar');
  fs.mkdirSync(path.join(run, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(run, 'evidence/console.log'), 'log');
  fs.writeFileSync(path.join(run, 'run.json'), '{}');
  return { root, run, server };
}
const evidenceKept = (f) => assert.ok(fs.existsSync(path.join(f.run, 'evidence/console.log')) && fs.existsSync(path.join(f.run, 'run.json')));

test('cleans the staged copy on success and keeps the evidence', async (t) => {
  const f = fixture(t);
  const r = await withStaged({ runDir: f.run, dirs: [f.server] }, async () => 'ok');
  assert.equal(r, 'ok');
  assert.equal(fs.existsSync(f.server), false);
  evidenceKept(f);
});

test('cleans the staged copy when the run throws, and the error still propagates', async (t) => {
  const f = fixture(t);
  await assert.rejects(withStaged({ runDir: f.run, dirs: [f.server] }, async () => { throw new Error('boom'); }), /boom/);
  assert.equal(fs.existsSync(f.server), false);
  evidenceKept(f);
});

test('dirs may be supplied lazily', async (t) => {
  const f = fixture(t);
  await withStaged({ runDir: f.run, dirs: () => [f.server] }, async () => {});
  assert.equal(fs.existsSync(f.server), false);
});

test('keep (--keep-stage) leaves the staged copy in place', async (t) => {
  const f = fixture(t);
  await withStaged({ runDir: f.run, dirs: [f.server], keep: true }, async () => {});
  assert.ok(fs.existsSync(path.join(f.server, 'mods/a.jar')));
});

test('refuses to delete outside the run directory, the run directory itself, or a cache', (t) => {
  const f = fixture(t);
  const outside = path.join(f.root, 'other');
  fs.mkdirSync(outside);
  assert.throws(() => removeStaged(outside, f.run), /outside the run directory/);
  assert.throws(() => removeStaged(path.join(f.run, '..', 'other'), f.run), /outside the run directory/);
  assert.throws(() => removeStaged(f.run, f.run), /outside the run directory/);
  const cache = path.join(f.run, 'cache');
  fs.mkdirSync(cache);
  assert.throws(() => removeStaged(cache, f.run), /cache directory/);
  assert.ok(fs.existsSync(outside) && fs.existsSync(cache));
});

test('a refused target is logged by withStaged, not thrown, and nothing is deleted', async (t) => {
  const f = fixture(t);
  const logs = [];
  await withStaged({ runDir: f.run, dirs: [f.root], log: (m) => logs.push(m) }, async () => {});
  assert.ok(fs.existsSync(f.run));
  assert.match(logs.join('\n'), /staged cleanup skipped/);
});

test('pruneStaged keeps claimed entries and removes the rest', (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.run, 'logs'));
  pruneStaged(f.run, path.join(f.run, '..'), (n) => ['logs', 'run.json', 'evidence'].includes(n));
  assert.deepEqual(fs.readdirSync(f.run).sort(), ['evidence', 'logs', 'run.json']);
});
