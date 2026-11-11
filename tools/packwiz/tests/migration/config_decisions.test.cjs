'use strict';
// Every shipped config has a recorded migration treatment, and every removal decision holds in the tree.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { listRepoFiles } = require('../../pack_index.cjs');

const ROOT = path.resolve(__dirname, '../../../..');
const decisions = JSON.parse(fs.readFileSync(path.join(__dirname, '../../migration/config-decisions.json'), 'utf8'));
const TREATMENTS = new Set(['carry', 'regenerate', 'preserve-intent']);

test('every shipped config and default config matches a decision rule with a reason', () => {
  const files = listRepoFiles(ROOT).filter((f) => /^(config|defaultconfigs)\//.test(f));
  assert.ok(files.length > 100);
  for (const f of files) {
    const rule = decisions.rules.find((r) => f.startsWith(r.match));
    assert.ok(rule, `${f} has no config decision`);
    assert.ok(TREATMENTS.has(rule.treatment) && rule.reason, `${f}: rule ${rule.match} needs a known treatment and a reason`);
  }
  for (const r of decisions.rules) assert.ok(files.some((f) => f.startsWith(r.match)), `rule ${r.match} matches nothing`);
});

test('removed and replaced configs are gone and replacements exist', () => {
  for (const r of decisions.removed) {
    assert.ok(r.reason, r.file);
    assert.equal(fs.existsSync(path.join(ROOT, r.file)), false, `${r.file} should be removed`);
    if (r.by) assert.ok(fs.existsSync(path.join(ROOT, r.by)), `${r.by} replaces ${r.file}`);
  }
});
