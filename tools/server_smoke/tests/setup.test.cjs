'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareRunDir, readRunSeed } = require('../setup.cjs');

test('prepareRunDir writes the requested level-seed into server.properties', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-setup-'));
  try {
    const base = path.join(root, 'base');
    fs.mkdirSync(path.join(base, 'libraries'), { recursive: true });
    const run = path.join(root, 'run');
    prepareRunDir(base, run, 25599, '4G', '12345');
    const props = fs.readFileSync(path.join(run, 'server.properties'), 'utf8');
    assert.match(props, /^level-seed=12345$/m);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('readRunSeed returns the run level-seed, or null without one', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-seed-'));
  try {
    assert.strictEqual(readRunSeed(root), null);
    fs.writeFileSync(path.join(root, 'server.properties'), 'motd=x
level-seed=777
');
    assert.strictEqual(readRunSeed(root), '777');
    fs.writeFileSync(path.join(root, 'server.properties'), 'motd=x
');
    assert.strictEqual(readRunSeed(root), null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
