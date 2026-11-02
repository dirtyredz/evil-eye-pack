'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inside, noLinks, output } = require('../path_guard.cjs');

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
