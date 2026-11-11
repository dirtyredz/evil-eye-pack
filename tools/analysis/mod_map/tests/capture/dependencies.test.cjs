'use strict';
// Analysis must remain usable without the test runners, including through shared modules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
