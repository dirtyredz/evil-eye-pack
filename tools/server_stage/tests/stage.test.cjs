'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'server-session-'));
const { NEO } = require('./fixtures.cjs');
const { writeStamp } = require('../../runtime_env/server/runtime.cjs');
const { ensureStage } = require('../stage.cjs');
test('a stage built for another runtime, or never stamped, is rebuilt rather than reused', async () => {
  const root = tmp();
  try {
    const cache = path.join(root, 'cache');
    const base = path.join(cache, 'loader-base', NEO.id);
    fs.mkdirSync(path.join(base, path.dirname(NEO.argsFile)), { recursive: true });
    fs.writeFileSync(path.join(base, NEO.argsFile), 'args');
    fs.mkdirSync(path.join(base, 'libraries/neo'), { recursive: true });
    fs.writeFileSync(path.join(base, 'libraries/neo/lib.jar'), 'neo');
    writeStamp(base, NEO);
    const stage = path.join(root, 'stage');
    fs.mkdirSync(path.join(stage, 'libraries/forge'), { recursive: true });
    fs.writeFileSync(path.join(stage, 'libraries/forge/old.jar'), 'forge libs from the old hazard');
    const scope = { run: async () => ({ code: 0, out: '' }) };
    const logs = [];
    // This fake installer tests runtime reuse, not the real checkout's private artifact pins.
    const pack = path.join(root, 'pack.toml');
    fs.writeFileSync(pack, 'name = "fixture"\n');
    await ensureStage(stage, { cache, runtime: NEO, java: 'java', pack, log: (m) => logs.push(m), scope, seed: '1', port: 1, heap: '1G' });
    assert.ok(!fs.existsSync(path.join(stage, 'libraries/forge/old.jar')), 'unstamped Forge libraries are not reused');
    assert.ok(fs.existsSync(path.join(stage, 'libraries/neo/lib.jar')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(stage, 'runtime.json'), 'utf8')).id, NEO.id);
    assert.match(logs.join('\n'), /rebuilding for neoforge-1\.21\.1-21\.1\.265/);
    fs.writeFileSync(path.join(stage, 'libraries/neo/kept.txt'), 'kept');
    await ensureStage(stage, { cache, runtime: NEO, java: 'java', pack, log: () => {}, scope, seed: '1', port: 1, heap: '1G' });
    assert.ok(fs.existsSync(path.join(stage, 'libraries/neo/kept.txt')), 'a matching stage is reused');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
