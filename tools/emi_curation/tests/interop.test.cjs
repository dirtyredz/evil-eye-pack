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

test('filterToList keeps matching elements in order and returns an immutable copy', () => {
  const c = boot();
  const I = c.ns().interop;
  const base = c.world.EmiStackList.stacks;
  const all = c.ids(base);
  const kept = I.filterToList(base, (s) => String(s.getId()) !== all[0]);
  assert.deepEqual(c.ids(kept), all.slice(1));
  assert.throws(() => kept.add(base.get ? base.get(0) : null));
});

test('isItemKey tells item stacks from fluid stacks', () => {
  const c = boot();
  const I = c.ns().interop;
  const stacks = c.world.EmiStackList.stacks;
  const n = stacks.size ? stacks.size() : stacks.length;
  let items = 0;
  for (let i = 0; i < n; i++) {
    const s = stacks.get ? stacks.get(i) : stacks[i];
    assert.equal(I.isItemKey(s), I.describe(s).isItem);
    if (I.isItemKey(s)) items++;
  }
  assert.ok(items > 0);
});
