'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SCHEMA, validateManifest, loadRun, manifestReady } = require('../verdict/protocol.cjs');

const T = 'tok1';
const names = ['a', 'b'];
const man = (over = {}) => ({ schema: SCHEMA, token: T, sections: names.map((name) => ({ name, file: `${name}.json`, count: 2, ok: true, ms: 5 })), ...over });
const payload = (name, over = {}) => ({ schema: SCHEMA, token: T, section: name, count: 2, data: { n: name }, ...over });

function withDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-test-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const put = (dir, f, v) => fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v));

test('a clean manifest has no errors and every section ok', () => {
  const v = validateManifest(man(), { token: T, expected: names });
  assert.deepEqual(v.errors, []);
  assert.equal(v.sections.a.ok, true);
});

test('wrong token and unsupported schema are manifest errors', () => {
  const v = validateManifest(man({ token: 'other', schema: 9 }), { token: T, expected: names });
  assert.equal(v.errors.length, 2);
  assert.match(v.errors.join('\n'), /schema 9/);
  assert.match(v.errors.join('\n'), /token other/);
});

test('duplicate section names are reported', () => {
  const m = man();
  m.sections.push({ ...m.sections[0] });
  assert.match(validateManifest(m, { token: T, expected: names }).errors.join(), /duplicate section a/);
});

test('a missing section and an ok:false section both fail, keeping the probe error', () => {
  const m = man();
  m.sections = [{ name: 'a', ok: false, error: 'boom' }];
  const v = validateManifest(m, { token: T, expected: names });
  assert.deepEqual(v.sections.a, { ok: false, error: 'boom' });
  assert.equal(v.sections.b.ok, false);
  assert.match(v.sections.b.error, /missing/);
});

test('non-object manifest is rejected', () => {
  assert.equal(validateManifest(null, { token: T }).errors.length, 1);
});

test('loadRun with no manifest fails every section', () => withDir((dir) => {
  const r = loadRun(dir, { token: T, expected: names });
  assert.match(r.manifestErrors[0], /manifest missing/);
  assert.deepEqual(Object.values(r.sections).map((s) => s.ok), [false, false]);
}));

test('loadRun accepts a good run and returns payload data', () => withDir((dir) => {
  put(dir, 'manifest.json', man());
  names.forEach((n) => put(dir, `${n}.json`, payload(n)));
  const r = loadRun(dir, { token: T, expected: names });
  assert.deepEqual(r.manifestErrors, []);
  assert.deepEqual(r.sections.a, { ok: true, data: { n: 'a' }, count: 2 });
}));

test('loadRun flags stale, miscounted and malformed payloads', () => withDir((dir) => {
  put(dir, 'manifest.json', man());
  put(dir, 'a.json', payload('a', { token: 'old' }));
  put(dir, 'b.json', payload('b', { count: 3 }));
  const r = loadRun(dir, { token: T, expected: names });
  assert.match(r.sections.a.error, /stale payload/);
  assert.match(r.sections.b.error, /count 3 != manifest 2/);
  put(dir, 'b.json', '{not json');
  assert.match(loadRun(dir, { token: T, expected: names }).sections.b.error, /unreadable/);
  fs.rmSync(path.join(dir, 'b.json'));
  assert.match(loadRun(dir, { token: T, expected: names }).sections.b.error, /payload missing/);
}));

test('manifestReady needs a parseable manifest with the right token', () => withDir((dir) => {
  assert.equal(manifestReady(dir, T), false);
  put(dir, 'manifest.json', '{partial');
  assert.equal(manifestReady(dir, T), false);
  put(dir, 'manifest.json', man({ token: 'x' }));
  assert.equal(manifestReady(dir, T), false);
  put(dir, 'manifest.json', man());
  assert.equal(manifestReady(dir, T), true);
}));
