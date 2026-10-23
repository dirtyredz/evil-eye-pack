'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeFinding, sectionResult } = require('../verdict/finding.cjs');

test('makeFinding stamps the check, defaults to fail and carries evidence only when given', () => {
  const f = makeFinding('demo');
  assert.deepEqual(f('c', 's', 'r', 'm'), { check: 'demo', code: 'c', subject: 's', ref: 'r', message: 'm', severity: 'fail' });
  assert.deepEqual(f('c', 's', null, 'm', 'info', { x: 1 }), { check: 'demo', code: 'c', subject: 's', ref: null, message: 'm', severity: 'info', evidence: { x: 1 } });
});

test('sectionResult is findings only when a finding fails, and merges extras', () => {
  const f = makeFinding('demo');
  assert.equal(sectionResult([f('a', 's', null, 'm', 'info')], {}).state, 'passed');
  const r = sectionResult([f('a', 's', null, 'm')], { n: 1 }, { counts: { t: 2 } });
  assert.deepEqual([r.state, r.stats, r.counts], ['findings', { n: 1 }, { t: 2 }]);
});
