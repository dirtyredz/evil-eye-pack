'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadScripts, ROOT } = require('./harness.cjs');
const F = require('./fake_emi.cjs');
const { bootDecor, names } = require('./decor_world.cjs');

const LOCAL = 'config/emi-curation/decor-local.json';

// ---- the pure logic ----

function pure() {
  const g = {};
  loadScripts({ global: g, Java: { loadClass() { throw new Error('no Java here'); } }, ClientEvents: { tick() {}, loggedOut() {} } },
    ['diagnostics', 'collections', 'decor/decor_policy', 'decor/decor_local']);
  return g.emiCuration.decorLocal;
}

function memoryIo(initial) {
  const io = { text: initial, writes: [], fail: false };
  io.read = () => io.text;
  io.write = (p, t) => { if (io.fail) throw new Error('disk full'); io.writes.push(p); io.text = t; };
  return io;
}

test('local marks cycle automatic -> decor -> not decor -> automatic, for items and for mods', () => {
  const L = pure();
  const d = L.empty();
  const seen = [];
  for (let i = 0; i < 4; i++) seen.push(L.cycleItem(d, 'a:b'));
  assert.deepEqual(seen, ['decor', 'not decor', 'automatic', 'decor']);
  const m = L.empty();
  const mods = [];
  for (let i = 0; i < 3; i++) mods.push(L.cycleMod(m, 'a'));
  assert.deepEqual(mods, ['decor', 'not decor', 'automatic']);
  assert.equal(L.itemState(L.empty(), 'a:b'), 'automatic');
  assert.deepEqual(Object.keys(m.mods).concat(Object.keys(m.notMods)), [], 'automatic leaves no entry behind');
});

test('lookup precedence: item mark, then mod mark, else null (the shipped rules decide)', () => {
  const L = pure();
  const d = L.empty();
  assert.equal(L.lookup(d, 'a:b'), null);
  L.cycleMod(d, 'a'); // mods
  assert.equal(L.lookup(d, 'a:b'), true);
  assert.equal(L.lookup(d, 'other:b'), null);
  L.cycleItem(d, 'a:b'); L.cycleItem(d, 'a:b'); // not decor
  assert.equal(L.lookup(d, 'a:b'), false, 'an item mark beats the mod mark');
  assert.equal(L.lookup(d, 'a:c'), true);
  L.cycleMod(d, 'a'); // notMods
  assert.equal(L.lookup(d, 'a:c'), false);
  L.cycleItem(d, 'a:c'); // decor
  assert.equal(L.lookup(d, 'a:c'), true, 'item decor beats notMods');
});

test('parse and serialize round trip, and malformed documents are rejected', () => {
  const L = pure();
  const d = L.empty();
  L.cycleItem(d, 'b:two'); L.cycleItem(d, 'a:one'); L.cycleItem(d, 'a:one');
  L.cycleMod(d, 'zmod');
  const text = L.serialize(d);
  assert.equal(JSON.parse(text).schema, 1);
  assert.deepEqual(JSON.parse(text).forceDecor, ['b:two']);
  assert.deepEqual(JSON.parse(text).forceNotDecor, ['a:one']);
  assert.equal(L.serialize(L.parse(text)), text);
  for (const bad of ['{ nope', '[]', '{"schema":2}', '{"schema":1,"forceDecor":"x"}', '{"schema":1,"forceDecor":["nocolon"]}',
    '{"schema":1,"mods":["Bad Mod"]}', '{"schema":1,"forceDecor":["a:b"],"forceNotDecor":["a:b"]}', '{"schema":1,"mods":["a"],"notMods":["a"]}']) {
    assert.throws(() => L.parse(bad), undefined, bad);
  }
  assert.equal(Object.keys(L.parse('{"schema":1}').forceDecor).length, 0, 'every list is optional');
});

test('load: absent file, empty marks, malformed file, unreadable file', () => {
  const L = pure();
  for (const absent of ['null', null, undefined, '', '  ']) assert.equal(L.load(memoryIo(absent)).status, 'missing');
  assert.equal(L.load(memoryIo('{"schema":1,"mods":["a"]}')).status, 'ok');
  const bad = L.load(memoryIo('{ nope'));
  assert.equal(bad.status, 'malformed');
  assert.equal(Object.keys(bad.data.mods).length, 0, 'a malformed file contributes nothing');
  const io = memoryIo();
  io.read = () => { throw new Error('boom'); };
  assert.equal(L.load(io).status, 'malformed');
});

test('mark persists through the injected IO, commits only after a successful save, and never overwrites a malformed file', () => {
  const L = pure();
  const io = memoryIo('null');
  const holder = L.load(io);
  const r1 = L.mark(holder, io, 'a:b', false);
  assert.deepEqual([r1.ok, r1.scope, r1.key, r1.state], [true, 'item', 'a:b', 'decor']);
  assert.deepEqual(io.writes, [LOCAL]);
  assert.equal(holder.status, 'ok');
  const again = L.load(io); // the round trip through the "file"
  assert.equal(L.lookup(again.data, 'a:b'), true);
  const r2 = L.mark(holder, io, 'a:b', true);
  assert.deepEqual([r2.ok, r2.scope, r2.key, r2.state], [true, 'mod', 'a', 'decor']);
  io.fail = true;
  const failed = L.mark(holder, io, 'a:c', false);
  assert.deepEqual([failed.ok, failed.reason], [false, 'save']);
  assert.equal(L.itemState(holder.data, 'a:c'), 'automatic', 'the failed item mark was not committed');
  assert.equal(L.lookup(holder.data, 'a:c'), true, 'the earlier mod mark still applies');
  const badIo = memoryIo('{ nope');
  const badHolder = L.load(badIo);
  const refused = L.mark(badHolder, badIo, 'a:b', false);
  assert.deepEqual([refused.ok, refused.reason], [false, 'malformed']);
  assert.equal(badIo.writes.length, 0);
  assert.equal(badIo.text, '{ nope', 'the owner file is left alone');
});

// ---- in game: key, hover, index ----

function fakeKey() {
  return { code: 68, unbound: false, isUnbound() { return this.unbound; }, matches(code) { return code === this.code; } };
}

function setup(opts) {
  const c = bootDecor(opts);
  c.g.emiCurationDecorKey = (opts && opts.noKey) ? undefined : fakeKey();
  c.screen = new F.AbstractContainerScreen(427, 240, 125, 37, 176, 166);
  c.press = (o) => {
    const k = Object.assign({ code: 68, mods: 0 }, o);
    let canceled = false;
    c.world.fireEvent('ScreenEvent$KeyPressed$Pre', {
      getScreen: () => c.screen, getKeyCode: () => k.code, getScanCode: () => 32, getModifiers: () => k.mods,
      setCanceled: (v) => { canceled = v !== false; },
    });
    return canceled;
  };
  c.file = () => c.files.get(LOCAL);
  c.lastToast = () => c.world.toasts[c.world.toasts.length - 1];
  return c;
}

test('the key cycles the hovered item, shows a toast, writes the local file and refreshes the index at once', () => {
  const c = setup();
  const s = c.ns().session;
  s.toggleDecor(); // DECOR: HIDDEN
  assert.ok(names(c).includes('create:cog') && !names(c).includes('minecraft:oak_stairs'));

  c.world.hover = c.d.cog;
  assert.equal(c.press(), true, 'the key is consumed');
  assert.deepEqual([c.lastToast().title, c.lastToast().msg], ['EMI Curation', 'cog: decor']);
  assert.ok(!names(c).includes('create:cog'), 'marked decor: gone from the index right away');
  assert.deepEqual(JSON.parse(c.file()).forceDecor, ['create:cog']);
  assert.equal(c.world.counters.reloads, 1, 'no EMI reload');

  c.press();
  assert.equal(c.lastToast().msg, 'cog: not decor');
  assert.ok(names(c).includes('create:cog'));
  c.press();
  assert.equal(c.lastToast().msg, 'cog: automatic');
  assert.ok(names(c).includes('create:cog'));
  assert.deepEqual(JSON.parse(c.file()).forceNotDecor, []);

  // A shipped-decor item: "not decor" brings it back while DECOR stays hidden, in ALL too.
  c.world.hover = c.d.stairs;
  c.press(); c.press();
  assert.equal(c.lastToast().msg, 'oak_stairs: not decor');
  assert.ok(names(c).includes('minecraft:oak_stairs'));
  s.toggle(); // ALL
  assert.ok(names(c).includes('minecraft:oak_stairs'));
  assert.equal(s.decorLabel(), 'DECOR: HIDDEN');
});

test('Shift cycles the whole mod; an item mark still beats the mod mark', () => {
  const c = setup();
  const s = c.ns().session;
  s.toggleDecor();
  c.world.hover = c.d.cog;
  assert.equal(c.press({ mods: 1 }), true);
  assert.equal(c.lastToast().msg, 'All of create: decor');
  assert.deepEqual(JSON.parse(c.file()).mods, ['create']);
  assert.ok(!names(c).includes('create:cog'));
  c.press({ mods: 1 });
  assert.equal(c.lastToast().msg, 'All of create: not decor');
  assert.ok(names(c).includes('create:cog'));
  c.world.hover = c.d.table; // handcrafted is a shipped decor mod
  c.press({ mods: 1 }); c.press({ mods: 1 });
  assert.ok(names(c).includes('handcrafted:oak_table'), 'local notMods beats the shipped mod list');
  c.press(); // item decor
  assert.ok(!names(c).includes('handcrafted:oak_table'), 'item mark beats the local mod mark');
});

test('marks persist: a fresh launch reads decor-local.json and layers it over decor.json', () => {
  const first = setup();
  first.ns().session.toggleDecor();
  first.world.hover = first.d.faucet; // shipped forceNotDecor
  first.press(); // local forceDecor beats shipped forceNotDecor
  first.world.hover = first.d.mortar;
  first.press(); first.press(); // not decor
  const saved = first.file();
  const c = setup({ files: [[LOCAL, saved]] });
  c.ns().session.toggleDecor();
  assert.ok(!names(c).includes('supplementaries:faucet'), 'local forceDecor over shipped forceNotDecor');
  assert.ok(names(c).includes('herbalwitch:mortar'));
  assert.ok(!names(c).includes('minecraft:oak_stairs'), 'untouched shipped rules still apply');
  assert.equal(c.logs.filter((l) => l[0] === 'error').length, 0);
});

test('a malformed decor-local.json is logged once and ignored; marking is refused and the file kept', () => {
  const c = setup({ files: [[LOCAL, '{ nope']] });
  c.ns().session.toggleDecor();
  assert.ok(!names(c).includes('minecraft:oak_stairs'), 'shipped rules still work');
  assert.equal(c.logs.filter((l) => l[0] === 'error' && /decor-local\.json/.test(l[1])).length, 1, 'reported once');
  c.world.hover = c.d.cog;
  assert.equal(c.press(), true);
  assert.match(c.lastToast().msg, /malformed/);
  assert.equal(c.file(), '{ nope', 'not overwritten');
  assert.ok(names(c).includes('create:cog'));
});

test('a failed save keeps the previous marks, says so and logs', () => {
  const c = setup();
  c.ns().session.toggleDecor();
  c.io.failWrites = true;
  c.world.hover = c.d.cog;
  c.press();
  assert.match(c.lastToast().msg, /Could not save/);
  assert.ok(names(c).includes('create:cog'), 'unchanged');
  assert.ok(c.logs.some((l) => l[0] === 'error' && /decor mark/.test(l[1])));
});

test('the key does nothing without a hovered stack, in a text field, or with the wrong key or modifiers', () => {
  const c = setup();
  c.world.hover = null;
  assert.equal(c.press(), false, 'nothing hovered: the key passes through');
  assert.equal(c.world.toasts.length, 0);
  assert.equal(c.files.size, 0);
  c.world.hover = c.d.cog;
  c.world.EmiScreenManager.search.focused = true;
  assert.equal(c.press(), false, 'typing in the EMI search box');
  c.world.EmiScreenManager.search.focused = false;
  c.screen.focused = new F.EditBox(true);
  assert.equal(c.press(), false, 'typing in another text field');
  c.screen.focused = null;
  assert.equal(c.press({ code: 69 }), false, 'another key');
  assert.equal(c.press({ mods: 2 }), false, 'Ctrl+D');
  assert.equal(c.press({ mods: 1 | 4 }), false, 'Shift+Alt+D');
  c.g.emiCurationDecorKey.unbound = true;
  assert.equal(c.press(), false, 'unbound key');
  assert.equal(c.files.size, 0);
  assert.equal(c.world.toasts.length, 0);
});

test('without the startup key mapping the feature is inert and says so once', () => {
  const c = setup({ noKey: true });
  c.world.hover = c.d.cog;
  assert.equal(c.press(), false);
  assert.equal(c.press(), false);
  assert.equal(c.logs.filter((l) => /key mapping is missing/.test(l[1])).length, 1);
  assert.equal(c.files.size, 0);
});

test('slots, tags and fluids: the vanilla slot is the fallback, a tag or a fluid gets a hint, not a mark', () => {
  const c = setup();
  c.ns().session.toggleDecor();
  c.world.hover = null;
  const item = c.d.cog.key;
  c.screen.slot = { hasItem: () => true, getItem: () => ({ getItem: () => item, getHoverName: () => F.EmiStack.prototype.getName.call(c.d.cog) }) };
  assert.equal(c.press(), true);
  assert.equal(c.lastToast().msg, 'cog: decor');
  c.screen.slot = null;
  c.world.hover = F.ingredient(c.d.cog, c.d.table);
  c.press();
  assert.match(c.lastToast().msg, /single item/);
  c.world.hover = new F.EmiStack(new F.Fluid('minecraft:water'));
  c.press();
  assert.match(c.lastToast().msg, /only items/);
  assert.deepEqual(JSON.parse(c.file()).forceDecor, ['create:cog'], 'only the slot item was marked');
});

test('the message falls back to the action bar when the toast fails', () => {
  const c = setup();
  c.world.failToast = true;
  c.world.hover = c.d.cog;
  c.press();
  assert.equal(c.world.actionbar.length, 1);
  assert.deepEqual([c.world.actionbar[0].text, c.world.actionbar[0].overlay], ['EMI Curation: cog: decor', true]);
});

test('a script reload re-reads decor-local.json', () => {
  const c = setup();
  c.ns().session.toggleDecor();
  c.files.set(LOCAL, JSON.stringify({ schema: 1, forceDecor: ['create:cog'] }));
  c.load();
  c.tick();
  assert.ok(!names(c).includes('create:cog'));
});

// ---- the startup script ----

test('the startup script registers a GUI-context D key in the "EMI Curation" category and shares it through global', () => {
  const file = path.join(ROOT, 'kubejs', 'startup_scripts', 'emi_curation_keys.js');
  let handler = null;
  let registered = null;
  const calls = [];
  class KeyMapping { constructor(...a) { calls.push(a); } }
  const classes = {
    'net.minecraft.client.KeyMapping': KeyMapping,
    'net.minecraftforge.client.settings.KeyConflictContext': { GUI: 'GUI' },
    'com.mojang.blaze3d.platform.InputConstants$Type': { KEYSYM: 'KEYSYM' },
  };
  const g = {};
  const sandbox = {
    global: g, console: { error: () => { throw new Error('unexpected console.error'); } },
    Platform: { isClientEnvironment: () => true },
    Java: { loadClass: (n) => classes[n] },
    ForgeModEvents: { onEvent: (cls, fn) => { assert.equal(cls, 'net.minecraftforge.client.event.RegisterKeyMappingsEvent'); handler = fn; } },
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
  handler({ register: (k) => { registered = k; } });
  assert.deepEqual(calls[0], ['key.emi_curation.mark_decor', 'GUI', 'KEYSYM', 68, 'key.categories.emi_curation']);
  assert.equal(registered, g.emiCurationDecorKey);
  const lang = JSON.parse(fs.readFileSync(path.join(ROOT, 'kubejs', 'assets', 'emi_curation', 'lang', 'en_us.json'), 'utf8'));
  assert.ok(lang['key.emi_curation.mark_decor'] && lang['key.categories.emi_curation'], 'both lang keys exist');
  // A dedicated server never touches the client-only classes.
  let touched = false;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), Object.assign({}, sandbox, { Platform: { isClientEnvironment: () => false }, ForgeModEvents: { onEvent: () => { touched = true; } } }));
  assert.equal(touched, false);
});
