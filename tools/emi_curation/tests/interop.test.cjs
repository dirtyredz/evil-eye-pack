'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./support/harness.cjs');
const F = require('./support/fake_emi.cjs');

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

test('hiding caches one verdict per registry key while NBT decisions stay per stack', () => {
  const c = boot();
  const ns = c.ns();
  const p = ns.policy.compile({ schema: 1, itemLists: [], namespaces: ['hidden'],
    nbtExceptions: [{ ids: ['a:keep'], keepWhenNbtEquals: { mob: 'zombie' } }],
    hideWhenNbtHasKey: [{ ids: ['a:keys'], keys: ['mobId'] }],
  }, {});
  const configure = () => ns.hiding.configure({ policy: p, getMaster: () => c.world.EmiStackList.stacks });
  configure();
  const classify = ns.policy.classifyId;
  let classifications = 0, idReads = 0, nbtReads = 0;
  ns.policy.classifyId = (...args) => { classifications++; return classify(...args); };
  function stack(key, nbt) {
    const s = new F.EmiStack(key, nbt);
    const id = s.getId.bind(s), tag = s.getNbt.bind(s);
    s.getId = () => { idReads++; return id(); };
    s.getNbt = () => { nbtReads++; return tag(); };
    return s;
  }
  const hidden = ns.hiding.isPolicyHidden;
  const keep = new F.Item('a:keep'), keys = new F.Item('a:keys');
  const cases = [
    [stack(keep, { mob: 'zombie' }), false], [stack(keep, { mob: 'skeleton' }), true],
    [stack(keep), true], [stack(keys), false], [stack(keys, { mobId: 'zombie' }), true],
    [stack(keys, {}), false],
  ];
  for (let pass = 0; pass < 2; pass++) for (const [s, expected] of cases) assert.equal(hidden(s), expected);
  assert.equal(classifications, 2);
  assert.equal(idReads, 2);
  assert.equal(nbtReads, 12, 'reads every NBT variant on every decision');
  assert.equal(Object.hasOwn(p, 'idCache'), false, 'no second string-key cache');

  const shown = stack(new F.Item('a:shown'), { irrelevant: 'tag' });
  const excluded = stack(new F.Item('hidden:item'), { irrelevant: 'tag' });
  const fluid = stack(new F.Fluid('a:keep'), { mob: 'skeleton' });
  for (let pass = 0; pass < 2; pass++) {
    assert.equal(hidden(shown), false);
    assert.equal(hidden(excluded), true);
    assert.equal(hidden(fluid), false, 'same id with a different key is classified independently');
  }
  assert.equal(classifications, 5);
  assert.equal(idReads, 5);
  assert.equal(nbtReads, 12, 'show and hide verdicts never read NBT');
  configure();
  assert.equal(hidden(cases[0][0]), false);
  assert.equal(classifications, 6, 'configure invalidates the registry-key cache');
  assert.equal(idReads, 6);
});

test('reloaded hiding code starts a fresh classification cache for the same registry keys', () => {
  const c = boot();
  const key = new F.Item('a:item');
  const s = new F.EmiStack(key);
  let idReads = 0;
  s.getId = () => { idReads++; return key.id; };
  for (const namespace of [[], ['a']]) {
    c.load();
    const ns = c.ns();
    const p = ns.policy.compile({ schema: 1, itemLists: [], namespaces: namespace }, {});
    ns.hiding.configure({ policy: p, getMaster: () => c.world.EmiStackList.stacks });
    assert.equal(ns.hiding.isPolicyHidden(s), namespace.length > 0);
    assert.equal(ns.hiding.isPolicyHidden(s), namespace.length > 0);
  }
  assert.equal(idReads, 2);
});
