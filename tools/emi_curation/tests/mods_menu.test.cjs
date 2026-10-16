'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot, ROOT } = require('./harness.cjs');
const F = require('./fake_emi.cjs');

function setup(size) {
  const [W, H] = size || [427, 240];
  const c = boot();
  c.tick();
  const added = [];
  const screen = new F.AbstractContainerScreen(W, H, Math.floor((W - 176) / 2), Math.floor((H - 166) / 2), 176, 166);
  c.world.EmiScreenManager.search.y = H - 21;
  c.world.EmiScreenManager.search.x = Math.floor((W - 160) / 2);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  const render = () => c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen });
  render();
  const mouse = (x, y, button) => {
    const e = { getMouseX: () => x, getMouseY: () => y, getButton: () => button || 0, canceled: false, setCanceled(v) { this.canceled = v; } };
    c.world.fireEvent('ScreenEvent$MouseButtonPressed$Pre', e);
    return e;
  };
  const key = (code) => {
    const e = { getKeyCode: () => code, canceled: false, setCanceled(v) { this.canceled = v; } };
    c.world.fireEvent('ScreenEvent$KeyPressed$Pre', e);
    return e;
  };
  const post = (x, y) => {
    const g = F.fakeGraphics();
    c.world.fireEvent('ScreenEvent$Render$Post', { getScreen: () => screen, getGuiGraphics: () => g, getMouseX: () => x || 0, getMouseY: () => y || 0 });
    return g;
  };
  const rects = () => Array.from(c.ns().modsUi.rects);
  const center = (r) => [r.x + 1, r.y + 1];
  // added: [CLEAN, Mods]; the dropdown rows are drawn, not widgets
  return { c, screen, added, clean: added[0], mods: added[1], render, mouse, key, post, rects, center, search: c.world.EmiScreenManager.search, W, H };
}

const LABELS = ['Clear', 'Applied Energistics 2', 'Ender IO', 'Create'];

test('the Mods button sits beside CLEAN/ALL, not on top of it', () => {
  const t = setup();
  assert.equal(t.mods.visible, true);
  assert.equal(t.mods.msg.getString(), 'Mods ▾');
  assert.equal(t.added.length, 2, 'the rows are not widgets');
  const a = t.clean, b = t.mods;
  assert.equal(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, false);
  assert.equal(b.y, t.search.y);
  // CLEAN is left of the search bar; the EMI buttons block the left of CLEAN and the search
  // bar blocks its right, so Mods lands just right of the search bar.
  assert.equal(b.x, t.search.x + t.search.w + 2);
});

test('only loaded mods are listed, drawn on top; Clear comes first', () => {
  const t = setup();
  assert.equal(t.post().strings.length, 0, 'nothing drawn while closed');
  t.mods.press();
  const g = t.post();
  assert.equal(JSON.stringify(g.strings.map((s) => s.s)), JSON.stringify(LABELS));
  assert.ok(g.fills.length >= LABELS.length && g.fills.every((f) => f.z >= 500), 'drawn at a high z, above EMI');
  assert.equal(g.stack, 0, 'pose stack balanced');
  assert.ok(g.flushes >= 2, 'fills are flushed before the text');
});

test('choosing a mod sets @modid; choosing it again, or Clear, empties the search', () => {
  const t = setup();
  t.mods.press();
  const click = (i) => { const e = t.mouse(...t.center(t.rects()[i])); return e; };
  assert.equal(click(1).canceled, true, 'the click on a row is consumed');
  assert.equal(t.search.value, '@ae2');
  assert.equal(t.rects().length, 0, 'menu closed after choosing');
  t.mods.press();
  assert.equal(t.post().strings[1].s, '> Applied Energistics 2', 'active mod is marked');
  click(1);
  assert.equal(t.search.value, '');
  t.mods.press();
  click(2);
  assert.equal(t.search.value, '@enderio');
  t.mods.press();
  click(0);
  assert.equal(t.search.value, '');
  assert.equal(JSON.stringify(t.search.sets), JSON.stringify(['@ae2', '', '@enderio', '']));
});

test('a click outside or Esc closes the menu without touching the search', () => {
  const t = setup();
  t.search.value = 'iron';
  t.mods.press();
  assert.equal(t.mouse(t.mods.x + 1, t.mods.y + 1).canceled, false, 'the Mods button handles its own click');
  assert.equal(t.rects().length > 0, true);
  assert.equal(t.mouse(5, 5, 0).canceled, false, 'an outside click is not consumed');
  assert.equal(t.rects().length, 0);
  t.mods.press();
  assert.equal(t.key(65).canceled, false, 'other keys pass through');
  assert.equal(t.rects().length > 0, true);
  assert.equal(t.key(256).canceled, true, 'Esc is consumed while the menu is open');
  assert.equal(t.rects().length, 0);
  assert.equal(t.key(256).canceled, false, 'Esc passes through when closed');
  assert.equal(t.search.sets.length, 0);
  assert.equal(t.search.value, 'iron');
});

test('the menu hides with the EMI overlay and is inactive while EMI loads', () => {
  const t = setup();
  t.mods.press();
  t.c.world.EmiConfig.enabled = false;
  t.render();
  assert.equal(t.mods.visible, false);
  assert.equal(t.rects().length, 0, 'menu closed with the overlay');
  assert.equal(t.post().strings.length, 0);
  t.c.world.EmiConfig.enabled = true;
  t.render();
  assert.equal(t.mods.visible, true);
  assert.equal(t.mods.active, true);
  t.c.world.EmiReloadManager.loaded = false;
  t.c.tick();
  t.render();
  assert.equal(t.mods.active, false, 'inactive while EMI is loading');
});

test('regression: the open dropdown is fully on screen at every window size and with a long list', () => {
  for (const size of [[427, 240], [854, 480], [320, 240], [1920, 1080], [250, 120]]) {
    for (const many of [false, true]) {
      const t = setup(size);
      if (many) {
        const mods = Array.from({ length: 60 }, (_, i) => ({ label: 'A long mod display name ' + i, modid: 'm' + i }));
        t.c.ns().modsUi.items = [{ label: 'Clear', modid: null }].concat(mods);
      }
      t.mods.press();
      const rs = t.rects();
      assert.equal(rs.length, t.c.ns().modsUi.items.length);
      for (const r of rs) {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= t.W && r.y + r.h <= t.H, size + ' ' + JSON.stringify(r) + ' is on screen');
      }
      const g = t.post();
      assert.equal(g.strings.length, rs.length, 'every row is drawn');
    }
  }
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
