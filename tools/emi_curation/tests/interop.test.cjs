'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./harness.cjs');
const F = require('./fake_emi.cjs');

test('JDK-internal immutable lists from EMI are copied, never reflected on', () => {
  F.opaque.on = true;
  try {
    const c = boot();
    c.tick();
    assert.equal(c.ns().session.label(), 'EMI: CLEAN');
    assert.ok(!c.logs.some((l) => l[0] === 'error'), 'no errors logged');
    const clean = c.world.EmiStackList.filteredStacks;
    assert.ok(!c.ids(clean).includes('minecraft:zombie_spawn_egg'));
    assert.ok(c.ids(clean).includes('minecraft:stone'));
    const hidden = c.world.EmiRecipes.manager.getRecipes().toArray().map((r) => r.id);
    assert.ok(!hidden.includes('r:hidden_out'));
    assert.ok(hidden.includes('r:visible'));
    c.ns().session.toggle();
    assert.equal(c.ns().session.label(), 'EMI: ALL');
  } finally {
    F.opaque.on = false;
  }
});
