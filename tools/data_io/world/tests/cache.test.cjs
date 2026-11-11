'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'server-session-'));
const { fakeStage, NEO, FORGE } = require('../../../server_stage/tests/fixtures.cjs');
const { writeStamp } = require('../../../runtime_env/server/runtime.cjs');
const { WORLD } = require('../../../server_stage/stage_runtime.cjs');
const { worldKey, restoreWorld, saveWorld } = require('../cache.cjs');
test('world cache identity: runtime, seed, profile and jar bytes, not just filenames', () => {
  const root = tmp();
  try {
    const stage = fakeStage(root);
    const key = worldKey(stage, '1', NEO);
    assert.equal(worldKey(stage, '1', NEO), key, 'stable for identical inputs');
    assert.notEqual(worldKey(stage, '1', FORGE), key, 'another loader runtime');
    assert.notEqual(worldKey(stage, '2', NEO), key, 'another seed');
    assert.notEqual(worldKey(stage, '1', NEO, 'showcase'), key, 'another generation profile');
    fs.writeFileSync(path.join(stage, 'mods/a.jar'), 'jar with new bytes, same filename');
    const changedJar = worldKey(stage, '1', NEO);
    assert.notEqual(changedJar, key, 'same filename, changed hash');
    fs.writeFileSync(path.join(stage, 'config/c.toml'), 'k = 2\n');
    assert.notEqual(worldKey(stage, '1', NEO), changedJar, 'world-shaping config');
    assert.throws(() => worldKey(stage, '1'), /needs the server runtime/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a cached world is never restored into a server of another runtime', () => {
  const root = tmp();
  try {
    const cache = path.join(root, 'worlds');
    const forgeServer = path.join(root, 'forge');
    fs.mkdirSync(path.join(forgeServer, WORLD), { recursive: true });
    fs.writeFileSync(path.join(forgeServer, WORLD, 'level.dat'), 'w');
    writeStamp(forgeServer, FORGE);
    assert.equal(saveWorld(cache, 'k1', forgeServer), true);
    const neoServer = path.join(root, 'neo');
    fs.mkdirSync(neoServer);
    writeStamp(neoServer, NEO);
    assert.throws(() => restoreWorld(cache, 'k1', neoServer), /generated under forge-1\.20\.1-47\.4\.10, not neoforge-1\.21\.1-21\.1\.265/);
    const sameServer = path.join(root, 'forge2');
    fs.mkdirSync(sameServer);
    writeStamp(sameServer, FORGE);
    assert.equal(restoreWorld(cache, 'k1', sameServer), true);
    fs.mkdirSync(path.join(cache, 'legacy', WORLD), { recursive: true });
    assert.throws(() => restoreWorld(cache, 'legacy', sameServer), /unrecorded runtime/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
