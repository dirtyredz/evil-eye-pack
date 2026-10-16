'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot, ROOT } = require('./harness.cjs');
const F = require('./fake_emi.cjs');

function setup() {
  const c = boot();
  c.tick();
  const added = [];
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  const render = () => c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen });
  render();
  const click = (x, y) => c.world.fireEvent('ScreenEvent$MouseButtonPressed$Pre', { getMouseX: () => x, getMouseY: () => y });
  const key = (code) => {
    const e = { getKeyCode: () => code, canceled: false, setCanceled(v) { this.canceled = v; } };
    c.world.fireEvent('ScreenEvent$KeyPressed$Pre', e);
    return e;
  };
  // added: [CLEAN, Mods, Clear, ...loaded entries]
  return { c, screen, added, clean: added[0], mods: added[1], items: added.slice(2), render, click, key, search: c.world.EmiScreenManager.search };
}

test('the Mods button sits beside CLEAN/ALL, not on top of it', () => {
  const t = setup();
  assert.equal(t.mods.visible, true);
  assert.equal(t.mods.msg.getString(), 'Mods ▾');
  const a = t.clean, b = t.mods;
  assert.equal(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, false);
  assert.equal(b.y, t.search.y);
  // CLEAN is left of the search bar; the EMI buttons block the left of CLEAN and the search
  // bar blocks its right, so Mods lands just right of the search bar.
  assert.equal(b.x, t.search.x + t.search.w + 2);
});

test('only loaded mods are listed; Clear comes first', () => {
  const t = setup();
  assert.deepEqual(t.items.map((i) => i.msg.getString()), ['Clear', 'Applied Energistics 2', 'Ender IO', 'Create']);
});

test('choosing a mod sets @modid; choosing it again, or Clear, empties the search', () => {
  const t = setup();
  t.mods.press();
  assert.equal(t.items.every((i) => i.visible), true, 'menu open');
  const ae2 = t.items[1];
  ae2.press();
  assert.equal(t.search.value, '@ae2');
  assert.equal(t.items.some((i) => i.visible), false, 'menu closed after choosing');
  t.mods.press();
  assert.equal(ae2.msg.getString(), '> Applied Energistics 2', 'active mod is marked');
  ae2.press();
  assert.equal(t.search.value, '');
  t.mods.press();
  t.items[2].press();
  assert.equal(t.search.value, '@enderio');
  t.mods.press();
  t.items[0].press();
  assert.equal(t.search.value, '');
  assert.deepEqual(t.search.sets, ['@ae2', '', '@enderio', '']);
});

test('a click outside or Esc closes the menu without touching the search', () => {
  const t = setup();
  t.search.value = 'iron';
  t.mods.press();
  assert.equal(t.items[0].visible, true);
  t.click(t.items[0].x + 1, t.items[0].y + 1);
  assert.equal(t.items[0].visible, true, 'a click on the menu does not close it');
  t.click(5, 5);
  assert.equal(t.items.some((i) => i.visible), false);
  t.mods.press();
  assert.equal(t.key(65).canceled, false, 'other keys pass through');
  assert.equal(t.items[0].visible, true);
  assert.equal(t.key(256).canceled, true, 'Esc is consumed while the menu is open');
  assert.equal(t.items.some((i) => i.visible), false);
  assert.equal(t.key(256).canceled, false, 'Esc passes through when closed');
  assert.deepEqual(t.search.sets, []);
  assert.equal(t.search.value, 'iron');
});

test('the menu hides with the EMI overlay and is inactive while EMI loads', () => {
  const t = setup();
  t.mods.press();
  t.c.world.EmiConfig.enabled = false;
  t.render();
  assert.equal(t.mods.visible, false);
  assert.equal(t.items.some((i) => i.visible), false, 'menu closed with the overlay');
  t.c.world.EmiConfig.enabled = true;
  t.render();
  assert.equal(t.mods.visible, true);
  assert.equal(t.mods.active, true);
  t.c.world.EmiReloadManager.loaded = false;
  t.c.tick();
  t.render();
  assert.equal(t.mods.active, false, 'inactive while EMI is loading');
});

test('hidden until EMI has laid the search bar out', () => {
  const c = boot();
  c.tick();
  Object.assign(c.world.EmiScreenManager.search, { x: 0, y: 0 });
  const added = [];
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  assert.equal(added[1].visible, false);
});

test('pure logic: parseList, visibleEntries, nextSearch', () => {
  const M = boot().ns().modsMenu;
  const list = M.parseList(JSON.stringify([
    { label: 'A', modid: 'a' }, { label: 'dup', modid: 'a' }, { label: '', modid: 'b' },
    { label: 'Bad', modid: 'Bad Id' }, { label: 'C', modid: 'c_1' }, null, { label: 3, modid: 'd' },
  ]));
  assert.equal(JSON.stringify(list), JSON.stringify([{ label: 'A', modid: 'a' }, { label: 'C', modid: 'c_1' }]));
  assert.equal(JSON.stringify(M.visibleEntries(list, (id) => id === 'c_1')), JSON.stringify([{ label: 'C', modid: 'c_1' }]));
  assert.throws(() => M.parseList('{}'));
  assert.equal(M.nextSearch('', 'ae2'), '@ae2');
  assert.equal(M.nextSearch('iron', 'ae2'), '@ae2');
  assert.equal(M.nextSearch('@ae2', 'ae2'), '');
  assert.equal(M.nextSearch(' @AE2 ', 'ae2'), '');
  assert.equal(M.nextSearch('@ae2x', 'ae2'), '@ae2');
});

test('menu layout opens upward, stays on screen and wraps into columns', () => {
  const M = boot().ns().modsMenu;
  const anchor = { x: 65, y: 219, w: 56, h: 18 };
  const one = M.layoutMenu(anchor, 5, { w: 427, h: 240 }, 100);
  assert.equal(one.rects.length, 5);
  assert.equal(one.rects[4].y + one.rects[4].h, 219, 'last row ends at the button');
  assert.ok(one.rects.every((r) => r.x === 65 && r.y >= 0));
  const many = M.layoutMenu(anchor, 40, { w: 427, h: 240 }, 100);
  assert.ok(many.rects.every((r) => r.y >= 0 && r.y + r.h <= 219 && r.x >= 0 && r.x + r.w <= 427));
  assert.ok(new Set(many.rects.map((r) => r.x)).size > 1, 'wrapped into columns');
  const edge = M.layoutMenu({ x: 400, y: 219, w: 56, h: 18 }, 3, { w: 427, h: 240 }, 100);
  assert.ok(edge.rects.every((r) => r.x + r.w <= 427));
  const down = M.layoutMenu({ x: 10, y: 5, w: 56, h: 18 }, 3, { w: 427, h: 240 }, 100);
  assert.equal(down.rects[0].y, 23, 'opens downward from a top anchor');
});

test('mods.json parses with no entry dropped as malformed or duplicate', () => {
  const M = boot().ns().modsMenu;
  const text = fs.readFileSync(path.join(ROOT, 'config', 'emi-curation', 'mods.json'), 'utf8');
  assert.equal(M.parseList(text).length, JSON.parse(text).length);
  assert.ok(JSON.parse(text).length >= 20);
});
