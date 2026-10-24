'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./support/harness.cjs');
const F = require('./support/fake_emi.cjs');

test('one Forge listener pair and one button per screen after repeated script reloads', () => {
  const c = boot();
  c.load(); c.load(); c.load();
  assert.equal(c.world.counters.listeners.length, 11, 'two CLEAN, six Mods menu, two DECOR and one decor-mark listener');
  c.tick();
  const added = [];
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  assert.ok(added.length >= 1);
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
  const B = boot().ns().placement;
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

test('forgeHooks.registerOnce: one listener per hook, dispatch through the reloadable table, throws are logged', () => {
  const c = boot();
  c.world.classes.EvA = 'EvA'; c.world.classes.EvB = 'EvB';
  const before = c.world.counters.listeners.length;
  const calls = [];
  const H = () => c.ns().forgeHooks;
  const hooks = [{ event: 'EvA', handler: 'a', label: 'a' }, { event: 'EvB', handler: 'b', label: 'b' }];
  c.ns().testTable = { a: (e) => calls.push(['old', e]), b: () => { throw new Error('boom'); } };
  H().registerOnce('testFlag', 'testTable', hooks);
  H().registerOnce('testFlag', 'testTable', hooks);
  assert.equal(c.world.counters.listeners.length, before + 2, 'second call registers nothing');
  c.ns().testTable = { a: (e) => calls.push(['new', e]), b: () => { throw new Error('boom'); } };
  c.world.fireEvent('EvA', 1);
  assert.deepEqual(calls, [['new', 1]], 'the replaced handler runs');
  const errs = c.logs.length;
  c.world.fireEvent('EvB', 2);
  assert.ok(c.logs.slice(errs).some((l) => l[0] === 'error' && /EMI curation \(b listener\): .*boom/.test(l[1])));
});

test('interop.isContainerScreen and literal', () => {
  const c = boot();
  const I = c.ns().interop;
  assert.equal(I.isContainerScreen(new F.AbstractContainerScreen(427, 240, 0, 0, 1, 1)), true);
  assert.equal(I.isContainerScreen(new F.Screen(427, 240)), false);
  assert.equal(I.literal('x').getString(), 'x');
});
