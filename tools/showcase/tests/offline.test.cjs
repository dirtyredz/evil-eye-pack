'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { sections, logGroups } = require('../check.cjs');

test('every shipped section has a committed headless check', () => {
  assert.ok(sections(path.resolve(__dirname, '../../..')).includes('contraption_storage'));
});
test('warning/error comparison ignores timestamps but retains new script failures', () => {
  const a = logGroups('[12:00:00] [main/WARN] known\n[12:00:01] [main/INFO] harmless');
  const b = logGroups('[13:00:00] [main/WARN] known\n[13:00:01] [Server thread/ERROR] showcase/command.js: failed');
  assert.equal(Object.keys(a).length, 1);
  assert.equal(Object.keys(b).filter(k => !a[k]).length, 1);
});

test('log comparison removes only run locations and Java object identities, retaining resource names', () => {
  const a = '[12:00:00] [main/WARN] Configuration C:/runs/baseline/server/config/example.toml wrong\n[12:00:00] [main/ERROR] parent=DisplayInfo@1a2b';
  const b = '[13:00:00] [main/WARN] Configuration C:/runs/check/server/config/example.toml wrong\n[13:00:00] [main/ERROR] parent=DisplayInfo@feed34';
  assert.deepEqual(logGroups(a, 'C:/runs/baseline/server'), logGroups(b, 'C:/runs/check/server'));
  assert.notDeepEqual(logGroups(a, 'C:/runs/baseline/server'), logGroups(b.replace('example.toml', 'different.toml'), 'C:/runs/check/server'));
});
