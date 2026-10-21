'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot, ROOT } = require('./harness.cjs');
const { fixture } = require('./fixture.cjs');
const F = require('./fake_emi.cjs');

// Adds `n` loaded mods, each owning one item, named 'A long mod display name <i>'.
function crowded(n) {
  const fx = fixture();
  for (let i = 0; i < n; i++) fx.spec.items.push(new F.EmiStack(new F.Item('m' + i + ':thing')));
  return fx;
}

function setup(size, many) {
  const [W, H] = size || [427, 240];
  const c = boot(many ? { fixture: crowded(many) } : undefined);
  for (let i = 0; i < (many || 0); i++) {
    c.loadedMods.add('m' + i);
    c.modNames['m' + i] = 'A long mod display name ' + String(i).padStart(2, '0');
  }
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
  // added: [CLEAN, Mods, DECOR]; the dropdown rows are drawn, not widgets
  return { c, screen, added, clean: added[0], mods: added[1], decor: added[2], render, mouse, key, post, tooltip, hoverAt, rects, center, search: c.world.EmiScreenManager.search, W, H };
}

// CLEAN index: stone, vials and compressed stacks. ae2 and dramaticdoors only own hidden items there.
const LABELS = ['Clear', 'AllTheCompressed', 'Ender IO', 'Minecraft'];

test('the Mods button sits beside CLEAN/ALL, not on top of it', () => {
  const t = setup();
  assert.equal(t.mods.visible, true);
  assert.equal(t.mods.msg.getString(), 'Mods ▾');
  assert.equal(t.added.length, 3, 'CLEAN, Mods and DECOR are widgets; the rows are not');
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
  assert.equal(t.search.value, '@allthecompressed', 'and still works');
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
  assert.equal(t.search.value, '@allthecompressed');
  assert.equal(t.rects().length, 0, 'menu closed after choosing');
  t.mods.press();
  assert.equal(t.post().strings[1].s, '> AllTheCompressed', 'active mod is marked');
  click(1);
  assert.equal(t.search.value, '');
  t.mods.press();
  click(2);
  assert.equal(t.search.value, '@enderio');
  t.mods.press();
  click(0);
  assert.equal(t.search.value, '');
  assert.equal(JSON.stringify(t.search.sets), JSON.stringify(['@allthecompressed', '', '@enderio', '']));
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

test('regression: the open dropdown is fully on screen at every window size, even with a long list, and never covers a control', () => {
  for (const size of [[427, 240], [854, 480], [320, 240], [1920, 1080], [250, 120]]) {
    for (const many of [0, 120]) {
      const t = setup(size, many);
      t.mods.press();
      const rs = t.rects();
      for (const r of rs) {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= t.W && r.y + r.h <= t.H, size + ' ' + JSON.stringify(r) + ' is on screen');
        for (const b of [t.clean, t.mods, t.decor]) {
          if (!b.visible) continue;
          const over = r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h;
          assert.equal(over, false, size + ' a row covers a button');
        }
      }
      const g = t.post();
      assert.equal(g.strings.length, rs.length, 'every visible row is drawn');
      if (!many && size[1] >= 240) assert.ok(Math.max(...rs.map((r) => r.w)) < 200 && new Set(rs.map((r) => r.x)).size === 1, 'the small list is one narrow column');
    }
  }
});

test('a long list is paged: Next and Prev wrap, every mod is reachable once, Esc and click-away still close', () => {
  const t = setup([427, 240], 120);
  t.mods.press();
  const ui = () => t.c.ns().modsUi;
  assert.ok(ui().pageCount > 1, 'needs several pages: ' + ui().pageCount);
  const labels = () => t.post().strings.map((s) => s.s);
  assert.equal(labels().filter((s) => s === '< Prev').length, 1);
  assert.match(labels().find((s) => s.startsWith('Next >')), /^Next > 1\/\d+$/);
  const seen = new Set();
  for (let p = 0; p < ui().pageCount; p++) {
    for (const s of labels()) if (/^(> )?A long mod display name/.test(s)) seen.add(s);
    const next = ui().rows.find((r) => r.kind === 'next').rect;
    const e = t.mouse(...t.center(next));
    assert.equal(e.canceled, true, 'the pager click is consumed');
    assert.equal(ui().open, true, 'the menu stays open while paging');
  }
  assert.equal(ui().page, 0, 'Next wraps to the first page');
  assert.equal(seen.size, 120, 'all 120 mods appear across the pages');
  const prev = ui().rows.find((r) => r.kind === 'prev').rect;
  t.mouse(...t.center(prev));
  assert.equal(ui().page, ui().pageCount - 1, 'Prev wraps to the last page');
  assert.equal(t.search.sets.length, 0, 'paging never touches the search');
  // choosing a row on a later page works
  const row = ui().rows.find((r) => r.kind === 'item');
  t.mouse(...t.center(row.rect));
  assert.match(t.search.value, /^@m\d+$/);
  t.mods.press();
  assert.equal(t.key(256).canceled, true);
  assert.equal(t.rects().length, 0);
  t.mods.press();
  assert.equal(t.mouse(5, 5).canceled, false);
  assert.equal(t.rects().length, 0);
});

test('the list is built automatically: loaded mods with indexed items, A-Z by display name, following CLEAN', () => {
  const t = setup();
  const drawn = () => { t.mods.press(); const s = t.post().strings.map((x) => x.s); t.mouse(5, 5); return s; };
  assert.equal(JSON.stringify(drawn()), JSON.stringify(LABELS));
  t.c.ns().session.toggle(); // ALL: ae2 and dramaticdoors own items again
  assert.equal(JSON.stringify(drawn()), JSON.stringify(['Clear', 'AllTheCompressed', 'Applied Energistics 2', 'Dramatic Doors', 'Ender IO', 'Minecraft']));
});

test('a new mod appears with no config edit; a namespace that is not a loaded mod does not', () => {
  const fx = fixture();
  fx.spec.items.push(new F.EmiStack(new F.Item('brandnew:gizmo')), new F.EmiStack(new F.Item('datapack_only:thing')));
  const c = boot({ fixture: fx });
  c.loadedMods.add('brandnew');
  c.modNames.brandnew = 'Brand New Mod';
  c.tick();
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.EmiScreenManager.search.y = 219;
  const added = [];
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  c.world.fireEvent('ScreenEvent$Render$Pre', { getScreen: () => screen, getMouseX: () => 0, getMouseY: () => 0 });
  added[1].press();
  const g = F.fakeGraphics();
  c.world.fireEvent('ScreenEvent$Render$Post', { getScreen: () => screen, getGuiGraphics: () => g, getMouseX: () => 0, getMouseY: () => 0 });
  const labels = g.strings.map((s) => s.s);
  assert.ok(labels.includes('Brand New Mod'));
  assert.ok(!labels.some((l) => /datapack/.test(l)));
});

test('pure logic: overrides parsing, buildEntries (rename, hide, pin, sort, unloaded) and nextSearch', () => {
  const M = boot().ns().modsList;
  const ov = M.parseOverrides(JSON.stringify({
    rename: { create: 'Create Mod', 'Bad Id': 'x', ae2: '   ', enderio: 3 },
    hide: ['kubejs', 'Bad Id', 7],
    pin: ['create'],
  }));
  assert.equal(JSON.stringify(ov), JSON.stringify({ rename: { create: 'Create Mod' }, hide: ['kubejs'], pin: ['create'] }));
  assert.equal(JSON.stringify(M.parseOverrides('{}')), JSON.stringify(M.emptyOverrides()));
  assert.throws(() => M.parseOverrides('[]'));
  assert.throws(() => M.parseOverrides('{"hide":"x"}'));
  const names = { zeta: 'Zeta', alpha: 'alpha', beta: 'Beta', create: 'Create', kubejs: 'KubeJS', noname: '' };
  const build = (owned, overrides, loaded) => M.buildEntries(owned, (id) => (loaded || Object.keys(names)).includes(id), (id) => names[id], overrides);
  const labels = (list) => list.map((e) => e.label);
  assert.equal(JSON.stringify(labels(build(['zeta', 'alpha', 'beta', 'create', 'beta', 'noname']))), JSON.stringify(['alpha', 'Beta', 'Create', 'noname', 'Zeta']), 'A-Z ignoring case, duplicates once, empty name falls back to the id');
  assert.equal(JSON.stringify(labels(build(['zeta', 'alpha', 'create', 'kubejs'], ov))), JSON.stringify(['Create Mod', 'alpha', 'Zeta']), 'pinned first, renamed, hidden dropped');
  assert.equal(JSON.stringify(labels(build(['zeta', 'ghost'], undefined))), JSON.stringify(['Zeta']), 'unloaded mods drop out');
  assert.equal(JSON.stringify(labels(build(['zeta', 'alpha'], { rename: {}, hide: [], pin: ['zeta', 'nope', 'zeta'] }))), JSON.stringify(['Zeta', 'alpha']));
  assert.equal(M.nextSearch('', 'ae2'), '@ae2');
  assert.equal(M.nextSearch('iron', 'ae2'), '@ae2');
  assert.equal(M.nextSearch('@ae2', 'ae2'), '');
  assert.equal(M.nextSearch(' @AE2 ', 'ae2'), '');
  assert.equal(M.nextSearch('@ae2x', 'ae2'), '@ae2');
});

test('menu layout is compact, opens upward, stays on screen and wraps only when height runs out', () => {
  const M = boot().ns().modsLayout;
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

test('paged layout: pages fit the screen, the pager sits next to the anchor, indexes are covered once', () => {
  const M = boot().ns().modsLayout;
  const screen = { w: 427, h: 240 };
  for (const anchor of [{ x: 65, y: 219, w: 56, h: 18 }, { x: 300, y: 4, w: 56, h: 18 }]) {
    const widths = Array.from({ length: 150 }, (_, i) => 60 + (i % 7) * 15);
    const first = M.layoutPaged(anchor, widths, screen, 0);
    assert.ok(first.pageCount > 1 && first.pager);
    const seen = [];
    for (let p = 0; p < first.pageCount; p++) {
      const lay = M.layoutPaged(anchor, widths, screen, p);
      assert.equal(lay.page, p);
      for (const r of lay.rows.map((x) => x.rect).concat([lay.pager.prev, lay.pager.next])) {
        assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= screen.w && r.y + r.h <= screen.h, JSON.stringify(r));
        assert.equal(r.x < anchor.x + anchor.w && anchor.x < r.x + r.w && r.y < anchor.y + anchor.h && anchor.y < r.y + r.h, false, 'never covers the anchor');
      }
      const up = anchor.y > 100;
      assert.equal(lay.pager.prev.y, up ? anchor.y - 12 : anchor.y + anchor.h, 'pager strip is the row next to the button');
      for (const x of lay.rows) seen.push(x.index);
    }
    assert.equal(JSON.stringify(seen), JSON.stringify(widths.map((_, i) => i)), 'every entry exactly once, in order');
  }
  assert.equal(M.layoutPaged({ x: 65, y: 219, w: 56, h: 18 }, [50, 60], screen, 3).pager, null, 'no pager when it fits');
  assert.equal(M.layoutPaged({ x: 65, y: 219, w: 56, h: 18 }, Array(150).fill(80), screen, 99).page > 0, true, 'page index is clamped');
});

test('mods.json (the override file) parses and is empty-safe', () => {
  const M = boot().ns().modsList;
  const text = fs.readFileSync(path.join(ROOT, 'config', 'emi-curation', 'mods.json'), 'utf8');
  const raw = JSON.parse(text);
  const ov = M.parseOverrides(text);
  assert.equal(raw.schema, 1);
  assert.equal(Object.keys(ov.rename).length, Object.keys(raw.rename).length, 'no rename dropped as malformed');
  assert.equal(ov.hide.length, raw.hide.length);
  assert.equal(ov.pin.length, raw.pin.length);
});

test('hidden until EMI has laid the search bar out', () => {
  const c = boot();
  c.tick();
  Object.assign(c.world.EmiScreenManager.search, { x: 0, y: 0 });
  const added = [];
  const screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.world.fireEvent('ScreenEvent$Init$Post', { getScreen: () => screen, addListener: (b) => added.push(b) });
  assert.equal(added[1].visible, false);
  assert.equal(added[2].visible, false);
});
