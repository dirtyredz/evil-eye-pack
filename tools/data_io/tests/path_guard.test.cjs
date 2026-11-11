'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inside, noLinks, output, artifactJob, checkDestination } = require('../path_guard.cjs');

test('artifactJob accepts the jobs root and descendants, but rejects escapes and siblings', () => {
  const root = 'C:/Users/dirty/.local-state/evil-eye-pack/artifacts/jobs';
  assert.doesNotThrow(() => artifactJob(root));
  assert.doesNotThrow(() => artifactJob(path.join(root, 'guard-test', 'closure')));
  for (const dir of [path.dirname(root), root + '-other', path.join(root, '..', 'outside')]) {
    assert.throws(() => artifactJob(dir), /^Error: Job must be in artifact jobs$/);
  }
});

test('inside is containment, case-insensitive, and rejects siblings', () => {
  assert.equal(inside('/a/b/c', '/a/b'), true);
  assert.equal(inside('/a/b', '/a/b'), true);
  assert.equal(inside('/a/bc', '/a/b'), false);
  assert.equal(inside('/a', '/a/b'), false);
});

test('output must be strictly below the job and outside protected paths', () => {
  const job = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
  try {
    assert.doesNotThrow(() => output(path.join(job, 'x'), job, []));
    assert.throws(() => output(job, job, []), /below job/);
    assert.throws(() => output(path.join(job, 'x'), job, [path.join(job, 'x')]), /Protected/);
    assert.doesNotThrow(() => noLinks(path.join(job, 'missing')));
  } finally { fs.rmSync(job, { recursive: true, force: true }); }
});

test('writable run folders must be under the artifacts root and outside every checkout', () => {
  const artifacts = 'C:/a/artifacts';
  assert.doesNotThrow(() => checkDestination('C:/a/artifacts/pack-test/runs/r1', { artifacts, checkouts: ['C:/a/repo'] }));
  assert.throws(() => checkDestination('C:/a/elsewhere/r1', { artifacts, checkouts: [] }), /outside the artifacts root/);
  assert.throws(() => checkDestination('C:/a/artifacts/repo/r1', { artifacts, checkouts: ['C:/a/artifacts/repo'] }), /inside a checkout/);
});
