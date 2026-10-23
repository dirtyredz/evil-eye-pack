'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { findingKey, validateBaseline, compareFindings, compareLogs, candidate } = require('../verdict/baseline.cjs');

const f = (code, subject, over = {}) => ({ check: 'recipes', code, subject, severity: 'fail', message: 'm', ...over });

test('findingKey is check|code|subject|ref and ignores message and severity', () => {
  assert.equal(findingKey(f('c', 's')), 'recipes|c|s|');
  assert.equal(findingKey(f('c', 's', { ref: 'r', message: 'zz', severity: 'info' })), 'recipes|c|s|r');
});

test('a valid baseline has no errors', () => {
  assert.deepEqual(validateBaseline({ schema: 1, findings: [{ key: 'a|b|c|', reason: 'ok' }], logSignatures: [{ signature: 's', reason: 'r' }] }), []);
});

test('validateBaseline flags every kind of defect', () => {
  assert.match(validateBaseline({ schema: 2 }).join(), /schema must be 1/);
  const e = validateBaseline({
    schema: 1,
    findings: [{ key: 'a|b', reason: 'x' }, { key: 'a|b|c|', reason: ' ' }, { key: 'a|b|c|', reason: 'x' }],
    logSignatures: [{ signature: 's' }, { signature: 's', reason: 'r' }, { reason: 'r' }]
  }).join('\n');
  assert.match(e, /malformed finding key/);
  assert.match(e, /finding without a reason/);
  assert.match(e, /duplicate finding key/);
  assert.match(e, /log signature without a reason: s/);
  assert.match(e, /duplicate log signature: s/);
  assert.match(e, /without a signature/);
});

test('compareFindings splits fail findings into new and known; info never new', () => {
  const base = { findings: [{ key: 'recipes|c|known|', reason: 'why' }] };
  const r = compareFindings([f('c', 'known'), f('c', 'fresh'), f('c', 'inf', { severity: 'info' })], base, new Set(['recipes']));
  assert.deepEqual(r.new.map((x) => x.subject), ['fresh']);
  assert.equal(r.known[0].reason, 'why');
  assert.deepEqual(r.info.map((x) => x.subject), ['inf']);
});

test('resolved only counts for completed checks', () => {
  const base = { findings: [{ key: 'recipes|c|gone|', reason: 'a' }, { key: 'loot|c|gone|', reason: 'b' }] };
  const r = compareFindings([], base, new Set(['recipes']));
  assert.deepEqual(r.resolved.map((x) => x.key), ['recipes|c|gone|']);
});

test('compareLogs groups by signature', () => {
  const base = { logSignatures: [{ signature: 'k', reason: 'r' }, { signature: 'gone', reason: 'r2' }] };
  const r = compareLogs([{ signature: 'k', count: 1 }, { signature: 'n', count: 2 }], base);
  assert.deepEqual(r.new.map((g) => g.signature), ['n']);
  assert.equal(r.known[0].reason, 'r');
  assert.deepEqual(r.resolved.map((s) => s.signature), ['gone']);
});

test('candidate appends TODO entries and keeps existing ones', () => {
  const base = { schema: 1, findings: [{ key: 'old|a|b|', reason: 'keep' }], logSignatures: [{ signature: 'o', reason: 'keep' }] };
  const c = candidate(base, { new: [{ key: 'new|a|b|', message: 'hm' }] }, { new: [{ signature: 'ns', sample: 'x' }] }, 'run1');
  assert.equal(c.findings.length, 2);
  assert.equal(c.findings[0].reason, 'keep');
  assert.match(c.findings[1].reason, /^TODO/);
  assert.equal(c.findings[1].since, 'run1');
  assert.equal(c.logSignatures.length, 2);
  assert.match(c.logSignatures[1].reason, /^TODO/);
});

test('candidate works from a null baseline', () => {
  const c = candidate(null, { new: [] }, { new: [] }, 'r');
  assert.deepEqual(c, { schema: 1, findings: [], logSignatures: [] });
});
