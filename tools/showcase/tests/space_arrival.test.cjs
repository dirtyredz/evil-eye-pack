'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('space travel checks arrival after the destination entity tracker advances', () => {
  const queue = [], checks = []; let pending = null, visible = null, done = false;
  const levels = ['moon', 'mars', 'venus', 'enceladus', 'io'].map(name => ({
    dimension: () => 'interstellaris:' + name, getHeight: () => 90, getMinBuildHeight: () => 0,
    getBlockState: () => 'minecraft:stone',
    getEntities: () => ({ size: () => visible === name ? 1 : 0, get: () => ({ getTags: () => ({ contains: () => true }) }) })
  }));
  const ns = { checks: {}, terrain() {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../checks/interstellaris_space.js'), 'utf8'), {
    global: { evilEyeShowcaseCheck: ns }, Java: { loadClass: n => n.endsWith('AABB') ? class {} : { WORLD_SURFACE: 'surface' } }
  });
  ns.checks.interstellaris_space({ origin: { x: 288, y: 240, z: 0 }, BP: class {},
    check: (ok, message) => { assert.ok(ok, message); checks.push(message); }, later: (ticks, fn) => queue.push(fn),
    server: { getAllLevels: () => ({ iterator: () => { let i = 0; return { hasNext: () => i < levels.length, next: () => levels[i++] }; } }) },
    level: { getBlockState: () => 'minecraft:air' }, pos() {}, shell: () => 'same', invoke: () => 1, verifyPlan() {}, verifyVolume() {},
    cmd: command => { if (command.startsWith('kill ')) visible = pending = null; },
    run: command => { const m = /execute in interstellaris:(\w+) run tp/.exec(command); if (m) pending = m[1]; return 1; },
    done: () => { done = true; }
  });
  let ticks = 0;
  while (queue.length && ticks++ < 50) { visible = pending; queue.shift()(); }
  assert.equal(done, true);
  assert.equal(checks.filter(s => s.startsWith('traveller arrived')).length, 2);
});
