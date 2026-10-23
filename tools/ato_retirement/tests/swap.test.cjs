'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../../..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const conversions = JSON.parse(read('kubejs/config/ato_retirement.json')).conversions;
const MAX = {'create:zinc_ingot': 64, 'create:brass_sheet': 16};

const stack = (id, count) => ({id, count, get empty() { return this.count <= 0; }, maxStackSize: MAX[id] || 64});
function load() {
  const given = [], logs = [];
  let handler;
  const env = {
    JsonIO: {read: () => JSON.parse(read('kubejs/config/ato_retirement.json'))},
    Item: {of: (id, count) => stack(id, count)},
    PlayerEvents: {inventoryChanged: fn => { handler = fn; }},
    console: {info: m => logs.push(m), error: m => logs.push('ERROR ' + m)}
  };
  vm.runInNewContext(read('kubejs/server_scripts/ato_retirement_swap.js'), env);
  const player = (slots, carried = null) => {
    const sets = [];
    return {username: 'Dev', give: s => given.push(s), sets, slots,
      inventory: {containerSize: slots.length, getItem: i => slots[i], setItem: (i, s) => { sets.push(i); slots[i] = s; }},
      containerMenu: {carried, getCarried() { return this.carried; }, setCarried(s) { this.carried = s; }}};
  };
  return {fire: (p, item) => handler({player: p, item}), player, given, logs};
}

test('the swap script reads the same manifest as the recipes and does not copy the table', () => {
  assert.ok(!read('kubejs/server_scripts/ato_retirement_swap.js').includes('alltheores:'));
  const h = load();
  assert.ok(h.logs.some(m => m.includes(Object.keys(conversions).length + ' items')));
});

test('every one of the 71 mapped items becomes its survivor with the same count', () => {
  const h = load();
  for (const [from, to] of Object.entries(conversions)) {
    const p = h.player([stack('minecraft:dirt', 3), stack(from, 10)]);
    h.fire(p, p.slots[1]);
    assert.deepEqual([p.slots[1].id, p.slots[1].count], [to, 10], from);
    assert.equal(p.slots[0].id, 'minecraft:dirt');
  }
  assert.equal(Object.keys(conversions).length, 71);
});

test('unmapped items, AllTheCompressed blocks and the survivors are never touched', () => {
  const h = load();
  for (const id of ['allthecompressed:iron_block_1x', 'allthecompressed:zinc_block_9x', 'alltheores:tin_ingot', 'create:zinc_ingot', 'minecraft:stone']) {
    const p = h.player([stack(id, 5)]);
    h.fire(p, p.slots[0]);
    assert.equal(p.sets.length, 0, id);
    assert.equal(p.slots[0].id, id);
  }
});

test('one event swaps every mapped stack, including the cursor, and re-firing is a no-op', () => {
  const h = load();
  const p = h.player([stack('alltheores:zinc_ingot', 12), stack('minecraft:dirt', 1), stack('alltheores:tin_dust', 64)], stack('alltheores:brass_ingot', 9));
  h.fire(p, p.slots[0]);
  assert.deepEqual(p.slots.map(s => [s.id, s.count]), [['create:zinc_ingot', 12], ['minecraft:dirt', 1], ['enderio:powdered_tin', 64]]);
  assert.deepEqual([p.containerMenu.carried.id, p.containerMenu.carried.count], ['create:brass_ingot', 9]);
  h.fire(p, p.slots[0]);
  h.fire(p, p.slots[2]);
  assert.equal(p.sets.length, 2);
});

test('a survivor with a smaller stack limit keeps the full count by giving the remainder', () => {
  const h = load();
  const p = h.player([stack('alltheores:brass_plate', 40)]);
  h.fire(p, p.slots[0]);
  assert.deepEqual([p.slots[0].id, p.slots[0].count], ['create:brass_sheet', 16]);
  assert.deepEqual(h.given.map(s => [s.id, s.count]), [['create:brass_sheet', 16], ['create:brass_sheet', 8]]);
});

test('an exception inside the listener is logged, never thrown, and later events still work', () => {
  const h = load();
  const bad = h.player([stack('alltheores:zinc_ingot', 1)]);
  bad.inventory.setItem = () => { throw new Error('boom'); };
  assert.doesNotThrow(() => h.fire(bad, bad.slots[0]));
  assert.ok(h.logs.some(m => m.startsWith('ERROR') && m.includes('boom')));
  const ok = h.player([stack('alltheores:zinc_ingot', 2)]);
  h.fire(ok, ok.slots[0]);
  assert.equal(ok.slots[0].id, 'create:zinc_ingot');
});
