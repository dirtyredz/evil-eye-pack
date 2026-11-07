'use strict';
// Equipment panel showcase: production layout and the check's sequence, without a server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = path.resolve(__dirname, '../../../../kubejs/server_scripts/showcase');
function load() {
  const context = vm.createContext({ global: {} });
  for (const file of ['plan.js', 'rigs/create_contraption.js', 'sections/evileye_equipment.js']) vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
  return context.global.evilEyeShowcase;
}
const signText = (b) => [...b.nbt.matchAll(/\\"text\\":\\"([^\\]*)\\"/g)].map((m) => m[1]).join(' ');

test('the section is static, vanilla-only, at least the hostile-terrain size, and labels each panel area', () => {
  const ns = load(), p = ns.validate(ns.sections.evileye_equipment());
  assert.ok(p.width >= 24 && p.depth >= 22, 'the shared terrain check builds up to 24 x 22');
  assert.equal(p.rig, null);
  assert.equal(p.fills.length, 0);
  for (const b of p.blocks) assert.ok(b.state.startsWith('minecraft:'), `${b.state} is vanilla`);
  assert.ok(p.blocks.some((b) => b.x === 12 && b.y === 0 && b.z === 17 && b.state === 'minecraft:chest[facing=north]'), 'a chest pad at 12,0,17');
  const label = p.blocks.find((b) => b.x === 14 && b.z === 17 && b.state.startsWith('minecraft:oak_sign'));
  assert.ok(label && signText(label).startsWith('BACKPACK CONTROLS'), 'the BACKPACK CONTROLS label sits at 14,17');
  assert.ok(label.x < p.width && label.z < p.depth && label.y < p.height, 'the label is inside the plan bounds');
  const text = p.blocks.filter((b) => b.state.startsWith('minecraft:oak_sign')).map(signText).join(' | ');
  for (const phrase of ['EQUIPMENT', 'press G', 'Curios button', 'LEFT: equipped', 'RIGHT: cosmetic', 'ARMOUR', 'COSMETIC ARMOUR', 'VISIBILITY', 'skin', 'STORAGE TABS', 'TRASH CAN', 'ACTION RAIL', 'RECIPE FILL', 'BACKPACK CONTROLS']) {
    assert.ok(text.includes(phrase), `a label names ${phrase}`);
  }
});

function runCheck(loaded, menus) {
  const ns = { checks: {}, terrain() {}, runCommand: () => 1 };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../checks/evileye_equipment.js'), 'utf8'), {
    global: { evilEyeShowcaseCheck: ns },
    Platform: { isLoaded: (id) => loaded.has(id) },
    Java: { loadClass: (n) => n.endsWith('BuiltInRegistries') ? { MENU: { containsKey: (k) => menus.has(k) } } : { parse: (x) => x } }
  });
  const queue = [], checks = [];
  let done = false, cleared = false;
  ns.checks.evileye_equipment({
    check: (ok, message) => { assert.ok(ok, message); checks.push(message); }, later: (t, fn) => queue.push(fn),
    shell: () => 'same', invoke: (_w, clear) => { if (clear) cleared = true; return 1; }, verifyPlan() {}, verifyVolume() {}, done: () => { done = true; }
  });
  while (queue.length) queue.shift()();
  return { done, cleared, checks };
}

test('the check builds, sees the owned menu type, Cosmetic Armor Reworked absent, then clears', () => {
  const r = runCheck(new Set(['evileye_tweaks', 'sophisticatedbackpacks']), new Set(['evileye_tweaks:equipment', 'evileye_tweaks:equipment_storage']));
  assert.equal(r.done, true);
  assert.equal(r.cleared, true);
  assert.ok(r.checks.includes('Cosmetic Armor Reworked is not loaded'));
});

test('a missing menu type or a loaded Cosmetic Armor Reworked fails the check', () => {
  assert.throws(() => runCheck(new Set(['evileye_tweaks', 'sophisticatedbackpacks']), new Set()), /equipment menu type/);
  assert.throws(() => runCheck(new Set(['evileye_tweaks', 'sophisticatedbackpacks']), new Set(['evileye_tweaks:equipment'])), /equipment_storage menu type/);
  assert.throws(() => runCheck(new Set(['evileye_tweaks', 'sophisticatedbackpacks', 'cosmeticarmorreworked']), new Set(['evileye_tweaks:equipment', 'evileye_tweaks:equipment_storage'])), /not loaded/);
  assert.throws(() => runCheck(new Set(['evileye_tweaks']), new Set(['evileye_tweaks:equipment', 'evileye_tweaks:equipment_storage'])), /Sophisticated Backpacks/);
});
