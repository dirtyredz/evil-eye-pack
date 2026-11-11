'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../../../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const tomlSection = (text, name) => {
  const start = text.indexOf(`[${name}]`);
  assert.ok(start >= 0, `missing [${name}]`);
  const rest = text.slice(start + name.length + 2);
  const next = rest.search(/^\s*\[/m);
  return next < 0 ? rest : rest.slice(0, next);
};

module.exports = { ROOT, read, tomlSection };
