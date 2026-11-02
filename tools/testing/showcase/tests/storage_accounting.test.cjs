'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('exact storage accounting pauses both hoppers with power that survives neighbour updates', () => {
  const blocks = new Map(), scheduled = [];
  const entities = { size: () => 1, get: () => ({ getType: () => 'create:super_glue' }) };
  const ns = { checks: {}, terrain() {} };
  const ctx = { global: { evilEyeShowcaseCheck: ns }, Java: { loadClass: n => n.endsWith('AABB') ? class {} : {} } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../checks/contraption_storage.js'), 'utf8'), ctx);
  ns.checks.contraption_storage({
    check: (ok, message) => assert.ok(ok, message), later: (ticks, fn) => scheduled.push(fn), amount: () => 162,
    level: { getEntities: () => entities }, origin: { x: 0, y: 0, z: 0 },
    shell: () => 'unchanged', plan: { width: 24, height: 9, depth: 22, fills: [] },
    invoke: () => 1, verifyPlan() {}, handler() {},
    set: (x, y, z, state) => blocks.set([x, y, z].join(), state)
  });
  assert.equal(scheduled.length, 1, 'setup finishes before the idle/assembly callback');
  // Vanilla HopperBlock recomputes ENABLED from neighbour power; an unpowered enabled=false
  // command is not a durable pause. Exercise the fixture's real placements under that update.
  for (const y of [2, 4]) {
    const powered = [[13, y, 16], [15, y, 16], [14, y - 1, 16], [14, y + 1, 16], [14, y, 15], [14, y, 17]]
      .some(at => blocks.get(at.join()) === 'minecraft:redstone_block');
    const enabledAfterUpdate = !powered;
    assert.equal(enabledAfterUpdate, false, `hopper at y=${y} must remain paused when PSI changes neighbours`);
  }
});
