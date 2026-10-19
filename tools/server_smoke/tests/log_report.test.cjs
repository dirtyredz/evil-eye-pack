'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze } = require('../log_report.cjs');

const noise = [{ pattern: 'Athena', why: 'known' }];

test('pass log: Done line, no errors', () => {
  const r = analyze('[12:00:00] [Server thread/INFO] [minecraft/DedicatedServer]: Done (31.5s)! For help, type "help"\n', noise);
  assert.strictEqual(r.doneSeconds, 31.5);
  assert.strictEqual(r.fresh.length, 0);
  assert.strictEqual(r.loadingFailed, false);
});

test('groups repeated errors by normalized signature and splits known noise', () => {
  const log = [
    '[12:00:01] [main/ERROR] [mod/Foo]: failed chunk 12',
    '[12:00:02] [main/ERROR] [mod/Foo]: failed chunk 99',
    '[12:00:03] [main/ERROR] [Athena]: model loader x not found',
    'java.lang.NoClassDefFoundError: a/b/C',
    'Caused by: java.lang.ClassNotFoundException: a.b.C',
    '[12:00:04] [main/FATAL] [FML]: Mod loading has failed'
  ].join('\n');
  const r = analyze(log, noise);
  assert.strictEqual(r.known.length, 1);
  assert.strictEqual(r.fresh.find((g) => g.sample.includes('failed chunk')).count, 2);
  assert.ok(r.fresh.some((g) => g.sample.startsWith('java.lang.NoClassDefFoundError')));
  assert.strictEqual(r.loadingFailed, true);
  assert.strictEqual(r.doneSeconds, null);
});
