'use strict';
// Every dedup.json hiddenOnly id needs a recorded reason in tools/dedup/hidden_reasons.json, and vice versa.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..', '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const hidden = read('kubejs/config/dedup.json').hiddenOnly;
const reasons = read('tools/dedup/hidden_reasons.json').reasons;

test('shipped hiddenOnly stays a plain array of unique ids', () => {
  assert.ok(Array.isArray(hidden));
  assert.equal(new Set(hidden).size, hidden.length);
});

test('every hiddenOnly id has a reason', () => {
  const missing = hidden.filter(id => !reasons[id]);
  assert.deepEqual(missing, [], 'add an entry to tools/dedup/hidden_reasons.json for: ' + missing.join(', '));
});

test('no reason names an id that is not hidden', () => {
  const set = new Set(hidden);
  const stale = Object.keys(reasons).filter(id => !set.has(id));
  assert.deepEqual(stale, [], 'remove from hidden_reasons.json (not in hiddenOnly): ' + stale.join(', '));
});

test('each reason records class, evidence and date', () => {
  for (const [id, r] of Object.entries(reasons)) {
    assert.ok(r.class && r.class.length > 2, id + ' class');
    assert.ok(r.evidence && r.evidence.length > 10, id + ' evidence');
    assert.match(r.date || '', /^\d{4}-\d{2}-\d{2}$/, id + ' date');
  }
});
