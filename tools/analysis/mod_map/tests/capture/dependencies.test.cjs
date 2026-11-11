'use strict';
// Analysis must remain usable without the test runners, including through shared modules: no require()
// into tools/testing and no file path that names it (a runtime copyFileSync of a testing file counts).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// A string literal or path.join argument naming tools/testing: 'tools/testing/x', 'testing/x', '../testing',
// path.join(root, 'tools', 'testing'), 'testing'. Code files only, so JSON data never matches.
const TESTING_PATH = /['"`](?:[^'"`\n]*[\\/])?testing(?:[\\/][^'"`\n]*)?['"`]/;

test('analysis stays independent of testing runners', () => {
  const tools = path.resolve(__dirname, '../../../..');
  const testing = path.join(tools, 'testing') + path.sep;
  const seen = new Set();
  function inspect(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    const imports = /(?:require\s*\(\s*|from\s+|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
    for (const [, specifier] of source.matchAll(imports)) {
      const dependency = require.resolve(path.resolve(path.dirname(file), specifier));
      assert.ok(!dependency.startsWith(testing), `${path.relative(tools, file)} imports ${path.relative(tools, dependency)}`);
      if (/\.[cm]?js$/.test(dependency)) inspect(dependency);
    }
    source.split('\n').forEach((line, i) => {
      assert.ok(!TESTING_PATH.test(line), `${path.relative(tools, file)}:${i + 1} names a path into tools/testing: ${line.trim()}`);
    });
  }
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'tests') walk(file);
      else if (entry.isFile() && /\.[cm]?js$/.test(file)) inspect(file);
    }
  }
  walk(path.join(tools, 'analysis'));
});

test('the testing-path detector catches the old runtime file reference', () => {
  assert.ok(TESTING_PATH.test("fs.copyFileSync(path.join(root, 'tools/testing/pack_test/probe/registries.js'), x)"));
  assert.ok(TESTING_PATH.test("path.join(root, 'tools', 'testing')"));
  assert.ok(TESTING_PATH.test('const p = `${root}/tools/testing/pack_test`'));
  assert.ok(!TESTING_PATH.test("const slug = 'antiscammergg-testing'"));
  assert.ok(!TESTING_PATH.test("require('../../runtime_env/server/capture/registries_probe.cjs')"));
});
