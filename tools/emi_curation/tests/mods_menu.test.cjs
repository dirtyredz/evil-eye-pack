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
  const render = () => c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen, getMouseX: () => 0, getMouseY: () => 0 });
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
  const tooltip = () => {
    const e = { canceled: false, setCanceled(v) { this.canceled = v; } };
    c.world.fireEvent('RenderTooltipEvent$Pre', e);
    return e;
  };
  const post = (x, y) => {
    const g = F.fakeGraphics();
    c.world.fireEvent('ScreenEvent$Render$Post', { getScreen: () => screen, getGuiGraphics: () => g, getMouseX: () => x || 0, getMouseY: () => y || 0 });
    return g;
  };
  const hoverAt = (x, y) => c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen, getMouseX: () => x, getMouseY: () => y });
  const rects = () => Array.from(c.ns().modsUi.rects);
  const center = (r) => [r.x + 1, r.y + 1];
  // added: [CLEAN, Mods]; the dropdown rows are drawn, not widgets
  return { c, screen, added, clean: added[0], mods: added[1], render, mouse, key, post, tooltip, hoverAt, rects, center, search: c.world.EmiScreenManager.search, W, H };
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

test('regression: runtime has no usable drawString/width; the menu uses drawWordWrap and estimated widths', () => {
  const g = F.fakeGraphics();
  assert.throws(() => g.drawString({}, 'x', 0, 0, -1), /ambiguous/, 'plain drawString is ambiguous');
  for (const k of ['m_280488_', 'drawString(net.minecraft.client.gui.Font,java.lang.String,int,int,int)']) assert.equal(g[k], undefined);
  const t = setup();
  assert.throws(() => t.c.world.Java.loadClass('net.minecraft.client.Minecraft').getInstance().font.width('x'), /ambiguous/);
  t.mods.press();
  assert.ok(t.post().strings.length > 0, 'labels drawn');
  assert.equal(t.c.logs.filter((l) => l[0] === 'error').length, 0, 'no errors logged while drawing and measuring');
  const widths = Array.from(t.rects(), (r) => r.w);
  assert.ok(Math.max(...widths) < 160 && Math.min(...widths) > 20, 'estimated widths: ' + widths);
});

test('text width estimate never undershoots vanilla advances for ASCII and is compact', () => {
  const t = setup();
  t.mods.press();
  const w = Array.from(t.rects(), (r) => r.w);
  // "> Applied Energistics 2" is 23 chars: at most 6 px each plus padding, at least 3 px each.
  assert.ok(w[1] <= 23 * 6 + 8 && w[1] >= 23 * 3);
});

test('the first draw logs the GuiGraphics draw members once', () => {
  const t = setup();
  t.mods.press();
  for (let i = 0; i < 5; i++) t.post();
  const infos = t.c.logs.filter((l) => l[0] === 'info' && /GuiGraphics members containing "draw"/.test(l[1]));
  assert.equal(infos.length, 1);
  assert.match(infos[0][1], /drawWordWrap/);
});

test('a draw failure is logged once but never disables the menu', () => {
  const t = setup();
  t.mods.press();
  const broken = () => {
    const g = F.fakeGraphics();
    g.drawWordWrap = () => { throw new Error('boom'); };
    t.c.world.fireEvent('ScreenEvent$Render$Post', { getScreen: () => t.screen, getGuiGraphics: () => g, getMouseX: () => 0, getMouseY: () => 0 });
    return g;
  };
  const before = t.c.logs.filter((l) => l[0] === 'error').length;
  assert.equal(broken().stack, 0, 'pose stack balanced after a failed draw');
  for (let i = 0; i < 20; i++) broken();
  const logged = t.c.logs.filter((l) => l[0] === 'error').slice(before).filter((l) => /mods draw/.test(l[1]));
  assert.equal(logged.length, 1, 'logged once');
  assert.ok(t.rects().length > 0, 'menu is still open after failures');
  t.mouse(...t.center(t.rects()[1]));
  assert.equal(t.search.value, '@ae2', 'and still works');
  t.mods.press();
  assert.ok(t.rects().length > 0, 'and reopens');
  assert.ok(t.post().strings.length > 0, 'a later healthy frame draws normally');
});

test('item and EMI tooltips under the open menu are cancelled; elsewhere they are not', () => {
  const t = setup();
  t.hoverAt(5, 5);
  assert.equal(t.tooltip().canceled, false, 'menu closed');
  t.mods.press();
  const r = t.rects()[1];
  t.hoverAt(r.x + 2, r.y + 2);
  assert.equal(t.tooltip().canceled, true, 'mouse over a row');
  t.hoverAt(5, 5);
  assert.equal(t.tooltip().canceled, false, 'mouse elsewhere');
});

test('only loaded mods are listed, drawn on top; Clear comes first', () => {
  const t = setup();
  assert.equal(t.post().strings.length, 0, 'nothing drawn while closed');
  t.mods.press();
  const g = t.post();
  assert.equal(JSON.stringify(g.strings.map((s) => s.s)), JSON.stringify(LABELS));
  assert.ok(g.fills.length >= LABELS.length && g.fills.every((f) => f.z >= 500), 'drawn at a high z, above EMI');
  // Regression: the labels were invisible in game. The text must be opaque (alpha != 0 in
  // the signed ARGB int), drawn after every fill, and above them.
  for (const s of g.strings) {
    assert.notEqual((s.c >>> 24) & 0xff, 0, 'text colour has a non-zero alpha');
    assert.equal(s.c | 0, s.c, 'text colour is a signed 32-bit int');
    assert.ok(s.seq > Math.max(...g.fills.map((f) => f.seq)), 'text is drawn after the fills');
    assert.ok(s.z > Math.max(...g.fills.map((f) => f.z)), 'text is above the fills');
  }
  for (const f of g.fills) assert.notEqual((f.c >>> 24) & 0xff, 0);
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

test('regression: the open dropdown is fully on screen and compact at every window size and with a long list', () => {
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
      if (!many && size[1] >= 240) assert.ok(Math.max(...rs.map((r) => r.w)) < 200 && new Set(rs.map((r) => r.x)).size === 1, 'the real list is one narrow column');
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

test('menu layout is compact, opens upward, stays on screen and wraps only when height runs out', () => {
  const M = boot().ns().modsMenu;
  const arr = (n, w) => Array.from({ length: n }, () => w);
  const anchor = { x: 65, y: 219, w: 56, h: 18 };
  const one = M.layoutMenu(anchor, arr(5, 90), { w: 427, h: 240 });
  assert.equal(one.rects.length, 5);
  assert.equal(one.rects[4].y + one.rects[4].h, 219, 'last row ends at the button');
  assert.ok(one.rects.every((r) => r.x === 65 && r.w === 90 && r.h === 12), 'one compact column, 12 px rows');
  const fits = M.layoutMenu(anchor, arr(17, 90), { w: 427, h: 240 });
  assert.equal(new Set(fits.rects.map((r) => r.x)).size, 1, 'still one column when the height fits');
  const many = M.layoutMenu(anchor, arr(40, 100), { w: 427, h: 240 });
  assert.ok(many.rects.every((r) => r.y >= 0 && r.y + r.h <= 219 && r.x >= 0 && r.x + r.w <= 427));
  assert.ok(new Set(many.rects.map((r) => r.x)).size > 1, 'wrapped into columns');
  const mixed = M.layoutMenu({ x: 0, y: 219, w: 56, h: 18 }, [50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 200, 40], { w: 427, h: 240 });
  const widthsByX = {};
  for (const r of mixed.rects) widthsByX[r.x] = r.w;
  assert.deepEqual(Object.values(widthsByX).map(Number).sort((x, y) => x - y), [50, 200], 'each column is as wide as its own longest row');
  const edge = M.layoutMenu({ x: 400, y: 219, w: 56, h: 18 }, arr(3, 100), { w: 427, h: 240 });
  assert.ok(edge.rects.every((r) => r.x + r.w <= 427));
  const down = M.layoutMenu({ x: 10, y: 5, w: 56, h: 18 }, arr(3, 100), { w: 427, h: 240 });
  assert.equal(down.rects[0].y, 23, 'opens downward from a top anchor');
});

test('mods.json parses with no entry dropped as malformed or duplicate', () => {
  const M = boot().ns().modsMenu;
  const text = fs.readFileSync(path.join(ROOT, 'config', 'emi-curation', 'mods.json'), 'utf8');
  assert.equal(M.parseList(text).length, JSON.parse(text).length);
  assert.ok(JSON.parse(text).length >= 20);
});
