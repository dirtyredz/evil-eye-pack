'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScripts } = require('./harness.cjs');
const F = require('./fake_emi.cjs');

const ZOMBIE = { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie' } } } };
const VILLAGER = { BlockEntityTag: { EntityStorage: { Entity: { id: 'minecraft:zombie_villager' } } } };

function fixture() {
  // One Item object per id, as in the registry, so NBT variants share their key.
  const registry = new Map();
  const S = (id, nbt) => {
    if (!registry.has(id)) registry.set(id, new F.Item(id));
    return new F.EmiStack(registry.get(id), nbt);
  };
  const s = {
    stone: S('minecraft:stone'),
    cell: S('ae2:creative_item_cell'),
    egg: S('minecraft:zombie_spawn_egg'),
    door: S('dramaticdoors:tall_oak_door'),
    zombieVial: S('enderio:filled_soul_vial', ZOMBIE),
    villagerVial: S('enderio:filled_soul_vial', VILLAGER),
    emptyVial: S('enderio:empty_soul_vial'),
    c4: S('allthecompressed:cobblestone_4x'),
    c1: S('allthecompressed:cobblestone_1x'),
    water: new F.EmiStack(new F.Fluid('minecraft:water')),
    removed: S('removedmod:thing'),
  };
  const I = F.ingredient;
  const R = (id, ins, outs, cats) => new F.Recipe(id, 'cat', ins, outs, cats);
  const r = {
    visible: R('r:visible', [I(s.stone)], [s.c1]),
    hiddenOut: R('r:hidden_out', [I(s.c1)], [s.c4]),
    hiddenIn: R('r:hidden_in', [I(s.cell)], [s.stone]),
    mixed: R('r:mixed', [I(s.cell, s.stone)], [s.c1]),
    catalyst: R('r:catalyst', [I(s.stone)], [s.c1], [I(s.cell)]),
    intrinsic: R('r:intrinsic', [I(s.removed)], [s.stone]),
    multi: R('r:multi', [I(s.stone)], [s.c1, s.egg]),
    empty: R('r:empty', [I(), I(s.stone)], [s.c1]),
    zombie: R('r:zombie', [I(s.emptyVial)], [s.zombieVial]),
    villager: R('r:villager', [I(s.emptyVial)], [s.villagerVial]),
    fluid: R('r:fluid', [I(s.water)], [s.stone]),
  };
  const items = [s.stone, s.cell, s.egg, s.door, s.zombieVial, s.villagerVial, s.emptyVial, s.c4, s.c1, s.water];
  return { s, r, spec: { items, recipes: Object.values(r) } };
}

function boot(opts) {
  const fx = fixture();
  const world = F.createWorld(fx.spec);
  const g = {};
  const ctx = { world, fx, g, events: null, logs: [] };
  ctx.load = (jsonIO) => {
    ctx.events = F.clientEvents();
    loadScripts({ global: g, Java: world.Java, ClientEvents: ctx.events.api, JsonIO: jsonIO, logs: ctx.logs });
  };
  ctx.tick = () => { for (const h of ctx.events.handlers.tick) h(); };
  ctx.logout = () => { for (const h of ctx.events.handlers.loggedOut) h(); };
  ctx.ns = () => g.emiCuration;
  ctx.ids = (list) => list.a.map((x) => x.key.id + (x.nbt ? '#' + x.nbt.BlockEntityTag.EntityStorage.Entity.id : ''));
  ctx.load(opts && opts.jsonIO);
  if (!(opts && opts.noReload)) { world.reload(); world.finishWorker(); }
  return ctx;
}

const recipeIds = (list) => list.a.map((r) => r.id).sort();

test('waits for EMI reload and the recipe worker before installing views', () => {
  const c = boot({ noReload: true });
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: ...');
  c.world.reload();
  const provisional = c.world.EmiRecipes.manager;
  c.tick();
  assert.equal(c.world.EmiRecipes.manager, provisional, 'must not wrap the provisional manager while the worker runs');
  assert.equal(c.ns().session.label(), 'EMI: ...');
  c.world.finishWorker();
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: CLEAN');
});

test('CLEAN hides every curated family from the index, keeping EMI order', () => {
  const c = boot();
  const emiList = c.world.EmiStackList.filteredStacks;
  c.tick();
  const shown = c.world.EmiStackList.filteredStacks;
  assert.notEqual(shown, emiList);
  assert.deepEqual(c.ids(shown), [
    'minecraft:stone', 'enderio:filled_soul_vial#minecraft:zombie', 'enderio:empty_soul_vial',
    'allthecompressed:cobblestone_1x', 'minecraft:water',
  ]);
  assert.equal(c.world.EmiStackList.stacks.size(), 10, 'master list untouched');
});

test('CLEAN filters recipe displays with the REI rule; ALL restores the baseline manager', () => {
  const c = boot();
  c.tick();
  const m = c.world.EmiRecipes.manager;
  assert.deepEqual(recipeIds(m.getRecipes()), ['r:catalyst', 'r:empty', 'r:fluid', 'r:mixed', 'r:visible', 'r:zombie']);
  assert.deepEqual(recipeIds(m.getRecipes('cat')), ['r:catalyst', 'r:empty', 'r:fluid', 'r:mixed', 'r:visible', 'r:zombie']);
  assert.equal(m.getRecipe('r:hidden_in'), null);
  assert.equal(m.getRecipe('r:visible'), c.fx.r.visible, 'recipe objects are the baseline objects');
  assert.deepEqual(recipeIds(m.getRecipesByOutput(c.fx.s.stone)), ['r:fluid']);
  assert.deepEqual(recipeIds(m.getRecipesByInput(c.fx.s.cell)), ['r:catalyst', 'r:mixed']);
  assert.equal(m.getRecipesByOutput(c.fx.s.stone), m.getRecipesByOutput(c.fx.s.stone), 'memoised view');
  assert.deepEqual(m.getCategories().a, ['cat']);

  c.ns().session.toggle();
  const all = c.world.EmiRecipes.manager;
  assert.ok(all instanceof F.Manager, 'ALL installs the real baseline manager');
  assert.equal(all.getRecipes().size(), Object.keys(c.fx.r).length);
  assert.equal(c.ns().session.label(), 'EMI: ALL');
});

test('CLEAN -> ALL -> CLEAN restores identical objects; repeated toggles never reload EMI', () => {
  const c = boot();
  const emiList = c.world.EmiStackList.filteredStacks;
  c.tick();
  const emiManager = c.ns().state.recipe.baseline;
  const cleanList = c.world.EmiStackList.filteredStacks;
  const cleanManager = c.world.EmiRecipes.manager;
  c.ns().session.toggle();
  assert.equal(c.world.EmiStackList.filteredStacks, emiList, 'ALL = EMI ordinary list object');
  assert.equal(c.world.EmiRecipes.manager, emiManager, 'ALL = EMI baseline manager object');
  c.ns().session.toggle();
  assert.equal(c.world.EmiStackList.filteredStacks, cleanList);
  assert.equal(c.world.EmiRecipes.manager, cleanManager);
  const before = c.world.counters.searchUpdates;
  for (let i = 0; i < 10; i++) { c.ns().session.toggle(); c.tick(); }
  assert.equal(c.ns().session.label(), 'EMI: CLEAN');
  assert.equal(c.world.counters.reloads, 1, 'no EMI reload from toggles');
  assert.equal(c.world.counters.searchUpdates - before, 10, 'one search refresh per toggle, none per idle tick');
});

test('toggles never save config or persistent data and never touch user-hidden stacks or favorites', () => {
  const c = boot();
  c.tick();
  for (let i = 0; i < 4; i++) c.ns().session.toggle();
  c.ns().session.logout();
  assert.equal(c.world.counters.persistentSaves, 0);
  assert.equal(c.world.counters.configWrites, 0);
  assert.equal(c.world.userHidden.size, 0);
  assert.deepEqual(c.world.favorites, ['minecraft:stone']);
});

test('script reload during ALL keeps ALL; during CLEAN rebuilds the wrapper without double wrapping', () => {
  const c = boot();
  c.tick();
  const emiManager = c.ns().state.recipe.baseline;
  c.ns().session.toggle();
  c.load();
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: ALL');
  assert.equal(c.world.EmiRecipes.manager, emiManager);
  c.ns().session.toggle();
  const oldWrapper = c.world.EmiRecipes.manager;
  c.load();
  c.tick();
  const newWrapper = c.world.EmiRecipes.manager;
  assert.notEqual(newWrapper, oldWrapper, 'reloaded code installs a fresh wrapper');
  assert.equal(c.ns().state.recipe.baseline, emiManager, 'wrapper wraps the EMI manager, not the old wrapper');
  assert.deepEqual(recipeIds(newWrapper.getRecipes()), recipeIds(oldWrapper.getRecipes()));
  c.ns().session.toggle();
  assert.equal(c.world.EmiRecipes.manager, emiManager);
});

test('an EMI-replaced index (user hide) is re-curated; ALL shows EMI\'s new list', () => {
  const c = boot();
  c.tick();
  c.world.EmiHidden.setVisibility(c.fx.s.c1, true); // EMI re-bakes filteredStacks
  c.tick();
  assert.deepEqual(c.ids(c.world.EmiStackList.filteredStacks), [
    'minecraft:stone', 'enderio:filled_soul_vial#minecraft:zombie', 'enderio:empty_soul_vial', 'minecraft:water',
  ]);
  // User-hidden c1 now also hides recipes whose only output is c1.
  assert.deepEqual(recipeIds(c.world.EmiRecipes.manager.getRecipes()), ['r:fluid', 'r:zombie']);
  c.ns().session.toggle();
  assert.equal(c.world.EmiStackList.filteredStacks.size(), 9, 'ALL = EMI list minus the user hide only');
});

test('an EMI reload (new generation) is followed; previous-generation objects are never restored', () => {
  const c = boot();
  c.tick();
  c.ns().session.toggle(); // ALL
  const oldManager = c.world.EmiRecipes.manager;
  c.world.reload();
  c.tick(); // worker busy: wait
  c.world.finishWorker();
  c.tick();
  assert.notEqual(c.world.EmiRecipes.manager, oldManager);
  assert.equal(c.world.EmiRecipes.manager, c.ns().state.recipe.baseline);
  assert.equal(c.ns().session.label(), 'EMI: ALL', 'session selection survives F3+T');
  c.ns().session.toggle();
  assert.equal(c.world.EmiStackList.filteredStacks.size(), 5);
});

test('logout restores EMI objects and resets to CLEAN; rejoin starts CLEAN', () => {
  const c = boot();
  const emiList = c.world.EmiStackList.filteredStacks;
  c.tick();
  const emiManager = c.ns().state.recipe.baseline;
  c.ns().session.toggle();
  c.ns().session.toggle(); // back to CLEAN with our views installed
  c.logout();
  assert.equal(c.world.EmiStackList.filteredStacks, emiList);
  assert.equal(c.world.EmiRecipes.manager, emiManager);
  assert.equal(c.ns().session.label(), 'EMI: ...');
  c.ns().session.toggle(); // ignored while waiting
  c.world.reload(); c.world.finishWorker();
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: CLEAN');
});

test('logout does not restore over objects EMI already replaced', () => {
  const c = boot();
  c.tick();
  c.world.reload(); c.world.finishWorker(); // new world objects, not yet synced
  const fresh = c.world.EmiStackList.filteredStacks;
  const freshManager = c.world.EmiRecipes.manager;
  c.logout();
  assert.equal(c.world.EmiStackList.filteredStacks, fresh);
  assert.equal(c.world.EmiRecipes.manager, freshManager);
});

test('curation that fails to load leaves EMI untouched and reports N/A', () => {
  const c = boot({ jsonIO: { readString: () => { throw new Error('missing file'); } } });
  const emiList = c.world.EmiStackList.filteredStacks;
  const emiManager = c.world.EmiRecipes.manager;
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: N/A');
  assert.equal(c.ns().session.canPress(), false);
  assert.equal(c.world.EmiStackList.filteredStacks, emiList);
  assert.equal(c.world.EmiRecipes.manager, emiManager);
  assert.ok(c.logs.some((l) => l[0] === 'error' && l[1].includes('load curation')));
});

test('a failed toggle restores the last complete view and shows ERROR; pressing retries', () => {
  const c = boot();
  c.tick(); // CLEAN installed
  c.ns().session.toggle(); // ALL (clean views are cached)
  const allList = c.world.EmiStackList.filteredStacks;
  c.ns().state.index.clean = null; // force a rebuild on the next CLEAN
  c.world.failFreeze = true;
  c.ns().session.toggle();
  assert.equal(c.ns().session.label(), 'EMI: ERROR');
  assert.equal(c.world.EmiStackList.filteredStacks, allList, 'last complete (ALL) view restored');
  assert.equal(c.ns().state.mode, 'ALL', 'does not claim CLEAN');
  c.world.failFreeze = false;
  c.ns().session.toggle(); // retry
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: ALL');
});

test('one Forge listener pair and one button per screen after repeated script reloads', () => {
  const c = boot();
  c.load(); c.load(); c.load();
  assert.equal(c.world.counters.listeners.length, 2);
  c.tick();
  const added = [];
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  assert.equal(added.length, 1);
  const b = added[0];
  c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen });
  assert.equal(b.visible, true);
  assert.equal(b.msg.getString(), 'EMI: CLEAN');
  assert.equal(b.x + b.w + 2, 133, 'sits just left of the search bar');
  b.press();
  assert.equal(b.msg.getString(), 'EMI: ALL');
  assert.equal(c.ns().state.mode, 'ALL');
  c.world.EmiConfig.enabled = false;
  c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen });
  assert.equal(b.visible, false, 'hidden with the EMI overlay');
});

test('first placement equals post-press placement: EMI lays the search bar out after Init.Post', () => {
  const c = boot();
  c.tick();
  const search = c.world.EmiScreenManager.search;
  // EMI 1.1.24: the static search widget is built at (0, 0) and only moved by
  // addWidgets, which runs at the RETURN of Screen.init (after Forge's Init.Post).
  Object.assign(search, { x: 0, y: 0, w: 160, h: 18 });
  const added = [];
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  const b = added[0];
  assert.equal(b.visible, false, 'hidden, not parked at the top, while the search bar is unplaced');
  // EMI's addWidgets runs now.
  Object.assign(search, { x: 133, y: 219, w: 160, h: 18 });
  // The event may hand over a different wrapper of the same screen: placement must not depend on identity.
  c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => Object.assign(Object.create(screen), {}) });
  assert.equal(b.visible, true);
  const first = { x: b.x, y: b.y, w: b.w };
  assert.deepEqual(first, { x: 65, y: 219, w: 66 });
  b.press();
  c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen });
  assert.deepEqual({ x: b.x, y: b.y, w: b.w }, first, 'press does not move it');
  // A different GUI scale / window size is followed from the search bar, not hardcoded.
  Object.assign(search, { x: 220, y: 399, w: 160, h: 18 });
  const big = new F.AbstractContainerScreen(600, 420, 212, 100, 176, 166);
  c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => big });
  assert.deepEqual({ x: b.x, y: b.y }, { x: 152, y: 399 });
});

test('searchPlaced rejects the unplaced (0, 0) search widget and off-screen bars', () => {
  const B = boot().ns().button;
  const scr = { w: 427, h: 240 };
  assert.equal(B.searchPlaced({ x: 0, y: 0, w: 160, h: 18 }, scr), false);
  assert.equal(B.searchPlaced({ x: 133, y: 219, w: 0, h: 18 }, scr), false);
  assert.equal(B.searchPlaced({ x: 300, y: 219, w: 160, h: 18 }, scr), false);
  assert.equal(B.searchPlaced({ x: 133, y: 219, w: 160, h: 18 }, scr), true);
});

test('the creative inventory tab rows are kept clear', () => {
  const c = boot();
  c.tick();
  const added = [];
  // Short screen: the tabs below the container reach the search bar row.
  const screen = new F.CreativeModeInventoryScreen(427, 200, 116, 32, 195, 136);
  c.world.EmiScreenManager.search.y = 179;
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  const b = added[0];
  const tabs = { x: 116, y: 0, w: 195, h: 32 + 136 + 32 };
  const overlaps = b.x < tabs.x + tabs.w && tabs.x < b.x + b.w && b.y < tabs.y + tabs.h && tabs.y < b.y + b.h;
  assert.equal(overlaps, false);
  assert.equal(b.visible, true);
});

test('non-container screens get no button; the button is inactive while EMI loads', () => {
  const c = boot({ noReload: true });
  const added = [];
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => new F.Screen(427, 240), addListener: (b) => added.push(b) });
  assert.equal(added.length, 0);
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  assert.equal(added[0].active, false);
  assert.equal(added[0].msg.getString(), 'EMI: ...');
});

test('placement avoids the container, EMI buttons and sidebar panels', () => {
  const c = boot();
  const B = c.ns().button;
  const base = { screen: { w: 427, h: 240 }, search: { x: 133, y: 219, w: 160, h: 18 }, avoid: [] };
  assert.deepEqual({ ...B.chooseRect(base) }, { x: 65, y: 219, w: 66, h: 18 });
  // A sidebar panel covering the left slot pushes it to the right of the search bar.
  const panel = (x, y) => x < 132 && y > 200;
  assert.deepEqual({ ...B.chooseRect({ ...base, isPanelAt: panel }) }, { x: 295, y: 219, w: 66, h: 18 });
  // A tall container (AE2 terminal) covering both sides pushes it above the search bar.
  const tall = { x: 120, y: 0, w: 240, h: 240 };
  const r = B.chooseRect({ ...base, search: { x: 133, y: 219, w: 160, h: 18 }, avoid: [tall], isPanelAt: () => false });
  assert.deepEqual({ ...r }, { x: 46, y: 219, w: 66, h: 18 });
  // Narrow screen: everything blocked -> clamped on screen.
  const narrow = B.chooseRect({ screen: { w: 170, h: 100 }, search: { x: 5, y: 80, w: 160, h: 18 }, avoid: [{ x: 0, y: 0, w: 170, h: 100 }] });
  assert.ok(narrow.x >= 0 && narrow.x + narrow.w <= 170);
});

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

test('a failing apply is reported once and not retried every tick until EMI changes or the owner retries', () => {
  const c = boot();
  c.world.failFreeze = true;
  c.tick();
  const recalcs = c.world.counters.recalcs;
  for (let i = 0; i < 50; i++) c.tick();
  assert.equal(c.ns().session.label(), 'EMI: ERROR');
  assert.equal(c.logs.filter((l) => l[0] === 'error' && l[1].includes('apply views')).length, 1, 'one failure logged');
  assert.equal(c.world.counters.recalcs, recalcs, 'no refresh churn while failing');
  c.world.failFreeze = false;
  for (let i = 0; i < 5; i++) c.tick();
  assert.equal(c.ns().session.label(), 'EMI: ERROR', 'still waiting for a retry');
  c.ns().session.toggle(); // owner retry
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: CLEAN');
});

test('a failed apply retries automatically when EMI replaces its lists', () => {
  const c = boot();
  c.world.failFreeze = true;
  c.tick(); c.tick();
  assert.equal(c.ns().session.label(), 'EMI: ERROR');
  c.world.failFreeze = false;
  c.world.reload(); c.world.finishWorker();
  c.tick();
  assert.equal(c.ns().session.label(), 'EMI: CLEAN');
});
