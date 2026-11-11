'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { coordinate, safeLibraryPath } = require('../stage.cjs');
const { main } = require('../run.cjs');
test('Maven paths retain classifiers for client, mapped and native jars', () => {
  assert.equal(coordinate('net.minecraft:client:1.21.1:srg'), 'net/minecraft/client/1.21.1/client-1.21.1-srg.jar');
  assert.equal(coordinate('org.lwjgl:lwjgl:3.3.3:natives-windows'), 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar');
});
test('cached metadata cannot escape the copied library tree', () => {
  for (const relative of ['../outside.jar', 'a/../../outside.jar', 'a\\..\\outside.jar', 'C:/outside.jar', '/outside.jar', '']) {
    assert.throws(() => safeLibraryPath(relative), /Unsafe library path/);
  }
  assert.equal(safeLibraryPath('net/example/a.jar'), 'net/example/a.jar');
});
test('missing arguments, unknown switches and instance outputs fail before staging', async () => {
  await assert.rejects(main([]), /required/);
  await assert.rejects(main(['--download', 'true']), /Expected/);
  await assert.rejects(main(['--out', 'C:/Users/dirty/MultiMC/instances/test', '--cache', '.']), /Job must be in artifact jobs/);
});
