'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EXIT, buildReport, toJson, summarize } = require('../../verdict/report.cjs');

const fail = (subject, over = {}) => ({ check: 'recipes', code: 'c', subject, severity: 'fail', message: 'msg', ...over });
const sec = (findings, state = 'findings', over = {}) => ({ state, findings, stats: {}, ...over });
const base = { findings: [{ key: 'recipes|c|known|', reason: 'accepted' }], logSignatures: [{ signature: 'old', reason: 'r' }] };
const build = (over = {}) => buildReport({ run: { target: 't' }, sections: { recipes: sec([]) }, baseline: base, ...over });

test('known and info findings alone exit 0', () => {
  const m = build({ sections: { recipes: sec([fail('known'), fail('i', { severity: 'info' })]) } });
  assert.equal(m.verdict.exit, EXIT.OK);
  assert.equal(m.verdict.label, 'PASS');
  assert.equal(m.sections.recipes.counts.known, 1);
  assert.equal(m.sections.recipes.counts.info, 1);
});

test('a new fail finding exits 1', () => {
  const m = build({ sections: { recipes: sec([fail('fresh')]) } });
  assert.equal(m.verdict.exit, EXIT.NEW);
  assert.equal(m.findings.new.length, 1);
});

test('a new log signature exits 1; a known one does not', () => {
  const logs = (sig) => ({ fresh: [{ signature: sig, count: 3 }], known: [], doneSeconds: 10 });
  assert.equal(build({ logs: logs('brand new') }).verdict.exit, 1);
  assert.equal(build({ logs: logs('old') }).verdict.exit, 0);
});

test('an incomplete section or infra error exits 2 even with new findings', () => {
  const inc = build({ sections: { recipes: sec([fail('fresh')]), loot: sec([], 'incomplete', { error: 'no payload' }) } });
  assert.equal(inc.verdict.exit, EXIT.INVALID);
  assert.deepEqual(inc.verdict.problems, ['loot: no payload']);
  const infra = build({ sections: { recipes: sec([fail('fresh')]) }, infraErrors: ['cleanup failed'] });
  assert.equal(infra.verdict.exit, 2);
  assert.equal(infra.verdict.label, 'INVALID RUN');
});

test('duplicate findings with the same key count once', () => {
  const m = build({ sections: { recipes: sec([fail('dup'), fail('dup', { message: 'again' })]), other: sec([fail('dup')]) } });
  assert.equal(m.findings.new.length, 1);
});

test('an invalid section state throws', () => {
  assert.throws(() => build({ sections: { recipes: sec([], 'bogus') } }), /invalid state bogus/);
});

test('resolved baseline entries come only from completed sections', () => {
  const m = build({ sections: { recipes: sec([]) } });
  assert.deepEqual(m.findings.resolved.map((r) => r.key), ['recipes|c|known|']);
  const inc = build({ sections: { recipes: sec([], 'incomplete') } });
  assert.deepEqual(inc.findings.resolved, []);
});

test('toJson drops internal comparison handles', () => {
  const j = toJson(build());
  assert.equal('_cmp' in j, false);
  assert.equal('_logCmp' in j, false);
});

test('report JSON retains acquisition exclusion reasons without adding findings', () => {
  const exclusions = { 'a:hidden': 'hidden_reasons.json: creative-technical: Render-state item.' };
  const j = toJson(build({ sections: { acquisition: sec([], 'passed', { exclusions }) } }));
  assert.deepEqual(j.sections.acquisition.exclusions, exclusions);
  assert.equal(j.verdict.exit, EXIT.OK);
  assert.deepEqual(j.findings.new, []);
});

test('summarize names the verdict, sections and new findings', () => {
  const text = summarize(build({ sections: { recipes: sec([fail('fresh', { ref: 'r' })]), loot: sec([], 'passed') } }));
  assert.match(text, /^mode: \S.* NEW FINDINGS \(exit 1\)/);
  assert.match(text, /recipes\s+findings/);
  assert.match(text, /loot\s+passed/);
  assert.match(text, /\[recipes\/c\] fresh -> r: msg/);
  assert.ok(text.endsWith('\n'));
});

test('the summary starts with the mode, and a shared-run re-run is noted', () => {
  const m = build({ run: { mode: 'anu (shared with J1)' } });
  assert.match(summarize(m).split('\n')[0], /^mode: anu \(shared with J1\)  PASS \(exit 0\)/);
  const re = summarize(build({ run: { mode: 'local (fallback: shared ANU run beside J1 was CPU-starved)', sharedAttempt: { text: 'HOST STARVED: x; re-ran once on this machine' } } }));
  assert.match(re.split('\n')[0], /^mode: local \(fallback: shared ANU run beside J1/);
  assert.match(re, /\nnote: HOST STARVED: x/);
});
