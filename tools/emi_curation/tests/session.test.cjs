'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./support/harness.cjs');
const F = require('./support/fake_emi.cjs');

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
    'create:zinc_ingot', 'minecraft:water',
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
  const emiManager = c.ns().recipeView.unwrap(c.world.EmiRecipes.manager);
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
  const emiManager = c.ns().recipeView.unwrap(c.world.EmiRecipes.manager);
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
  assert.equal(c.ns().recipeView.unwrap(c.world.EmiRecipes.manager), emiManager, 'wrapper wraps the EMI manager, not the old wrapper');
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
  const sortedManager = c.world.EmiRecipes.manager;
  c.tick();
  assert.notEqual(c.world.EmiRecipes.manager, oldManager);
  assert.equal(c.world.EmiRecipes.manager, sortedManager);
  assert.equal(c.ns().session.label(), 'EMI: ALL', 'session selection survives F3+T');
  c.ns().session.toggle();
  assert.equal(c.world.EmiStackList.filteredStacks.size(), 5);
});

test('logout restores EMI objects and resets to CLEAN; rejoin starts CLEAN', () => {
  const c = boot();
  const emiList = c.world.EmiStackList.filteredStacks;
  c.tick();
  const emiManager = c.ns().recipeView.unwrap(c.world.EmiRecipes.manager);
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
  c.ns().state.index.views = {}; // force a rebuild on the next CLEAN
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

test('recipe lifecycle remembers installed Java proxies and unwraps older wrappers after reload', () => {
  const c = boot();
  const baseline = c.world.EmiRecipes.manager;
  let current = baseline, proxies = 0;
  const javaRefs = new Set();
  Object.defineProperty(c.world.EmiRecipes, 'manager', {
    get: () => current,
    set(value) {
      // Rhino assignment creates a distinct Java interface proxy for a raw JS wrapper.
      if (value instanceof F.Manager || javaRefs.has(value)) current = value;
      else { current = new Proxy(value, {}); javaRefs.add(current); proxies++; }
    },
  });
  c.tick();
  const first = current;
  assert.equal(proxies, 1);
  assert.equal(c.ns().recipeView.viewFor(baseline), first);
  assert.equal(c.ns().recipeView.unwrap(first), baseline);
  c.ns().session.toggle(); c.ns().session.toggle();
  assert.equal(current, first, 'cached Java proxy reused');
  assert.equal(proxies, 1);
  c.load(); c.tick();
  assert.equal(proxies, 2, 'reload rebuilds using the new code');
  assert.notEqual(current, first);
  current = first; // another writer reinstalls a known older proxy
  c.tick();
  assert.equal(c.ns().recipeView.unwrap(current), baseline);
  assert.equal(proxies, 3);
  c.ns().session.toggle();
  assert.equal(current, baseline, 'ALL never restores one of our wrappers');
  c.logout();
  assert.equal(c.ns().recipeView.installed(), null);
});

test('recipe installation and refresh failures restore both views and permit a clean retry', () => {
  for (const site of ['install', 'refresh']) {
    const c = boot();
    c.tick();
    const clean = c.world.EmiRecipes.manager;
    const index = c.world.EmiStackList.filteredStacks;
    let current = clean, fail = true;
    if (site === 'install') {
      Object.defineProperty(c.world.EmiRecipes, 'manager', {
        get: () => current,
        set(value) {
          if (fail) { fail = false; throw new Error('manager assignment failed'); }
          current = value;
        },
      });
    } else {
      const refresh = c.ns().indexView.refresh;
      c.ns().indexView.refresh = () => {
        if (fail) { fail = false; throw new Error('refresh failed'); }
        refresh();
      };
    }
    assert.equal(c.ns().session.toggle(), false, site);
    assert.equal(c.ns().session.label(), 'EMI: ERROR');
    assert.equal(c.ns().state.mode, 'CLEAN');
    assert.equal(c.world.EmiStackList.filteredStacks, index);
    assert.equal(c.world.EmiRecipes.manager, clean);
    assert.equal(c.ns().recipeView.installed(), clean);
    c.ns().session.toggle(); c.tick();
    assert.equal(c.ns().session.label(), 'EMI: CLEAN');
    assert.notEqual(c.world.EmiRecipes.manager, clean, 'retry invalidates the old wrapper');
    assert.deepEqual(recipeIds(c.world.EmiRecipes.manager.getRecipes()), recipeIds(clean.getRecipes()));
  }
});

test('first reload adopts the former session recipe holder without losing the EMI baseline', () => {
  const c = boot();
  const baseline = c.world.EmiRecipes.manager;
  c.tick();
  const old = c.world.EmiRecipes.manager;
  c.ns().state.recipe = c.ns().recipeState;
  delete c.ns().recipeState;
  c.load(); c.tick();
  assert.equal(Object.hasOwn(c.ns().state, 'recipe'), false);
  assert.notEqual(c.world.EmiRecipes.manager, old);
  assert.equal(c.ns().recipeView.unwrap(c.world.EmiRecipes.manager), baseline);
  c.logout();
  assert.equal(c.world.EmiRecipes.manager, baseline);
});
