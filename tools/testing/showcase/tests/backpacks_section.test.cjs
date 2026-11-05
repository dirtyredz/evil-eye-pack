'use strict';
// Sophisticated Backpacks showcase: production layout and the check's sequence, without a server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = path.resolve(__dirname, '../../../../kubejs/server_scripts/showcase');
function load() {
  const context = vm.createContext({ global: {} });
  for (const file of ['plan.js', 'rigs/create_contraption.js', 'sections/sophisticated_backpacks.js']) vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
  return context.global.evilEyeShowcase;
}
const TIERS = ['backpack', 'copper_backpack', 'iron_backpack', 'gold_backpack', 'diamond_backpack', 'netherite_backpack'];

test('the section is static, at least the hostile-terrain size, and offers all six tiers beside Dank Storage', () => {
  const ns = load(), p = ns.validate(ns.sections.sophisticated_backpacks());
  assert.ok(p.width >= 24 && p.depth >= 22, 'the shared terrain check builds up to 24 x 22');
  assert.equal(p.rig, null);
  const ids = p.fills.flatMap((f) => f.items.map((i) => i[0]));
  for (const t of TIERS) assert.ok(ids.includes(`sophisticatedbackpacks:${t}`), `a chest holds ${t}`);
  assert.ok(ids.some((i) => i.startsWith('dankstorage:dank_')), 'Dank Storage units sit beside for comparison');
  assert.ok(p.blocks.some((b) => b.state.startsWith('create:mechanical_bearing[facing=up]')), 'the Create integration pad has a bearing');
  assert.ok(p.blocks.some((b) => b.x === 12 && b.y === 1 && b.z === 8 && b.state.startsWith('sophisticatedbackpacks:')), 'a backpack sits on the bearing');
});

const ALL = { loaded: ['sophisticatedbackpacks', 'sophisticatedcore', 'sophisticatedbackpackscreateintegration', 'curios'], tagged: TIERS, slots: ['back', 'head'], recipe: true };

function runCheck(opts) {
  const ns = { checks: {}, terrain() {} };
  const loaded = new Set(opts.loaded);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../checks/sophisticated_backpacks.js'), 'utf8'), {
    global: { evilEyeShowcaseCheck: ns },
    Platform: { isLoaded: (id) => loaded.has(id) },
    Java: {
      loadClass: (n) => {
        if (n.endsWith('BuiltInRegistries')) {
          return { ITEM: { key: () => 'item', get: (rl) => ({ rl, getDefaultInstance: () => ({ is: () => opts.tagged.includes(rl.replace('sophisticatedbackpacks:', '')) }) }), getKey: (item) => item.rl } };
        }
        if (n.endsWith('ResourceLocation')) return { parse: (x) => x };
        if (n.endsWith('TagKey')) return { create: () => 'tag' };
        return { getSlots: () => ({ containsKey: (k) => opts.slots.includes(k) }) };
      }
    }
  });
  const queue = [], checks = [];
  let done = false, cleared = false;
  ns.checks.sophisticated_backpacks({
    check: (ok, message) => { assert.ok(ok, message); checks.push(message); }, later: (t, fn) => queue.push(fn),
    shell: () => 'same', invoke: (_w, clear) => { if (clear) cleared = true; return 1; }, verifyPlan() {}, verifyVolume() {}, done: () => { done = true; },
    level: { server: { recipeManager: { byKey: () => ({ isPresent: () => opts.recipe }) } } }
  });
  while (queue.length) queue.shift()();
  return { done, cleared, checks };
}

test('the check builds, sees every mod, the back slot and tag membership, the recipe, then clears', () => {
  const r = runCheck(ALL);
  assert.equal(r.done, true);
  assert.equal(r.cleared, true);
  assert.ok(r.checks.includes('the Curios "back" slot type exists'));
  assert.ok(r.checks.includes('netherite_backpack is accepted by the Curios back slot (curios:back)'));
});

test('a missing mod, back slot, slot tag entry or recipe fails the check', () => {
  assert.throws(() => runCheck({ ...ALL, loaded: ALL.loaded.slice(0, 3) }), /curios is loaded/);
  assert.throws(() => runCheck({ ...ALL, slots: ['head'] }), /"back" slot type exists/);
  assert.throws(() => runCheck({ ...ALL, tagged: TIERS.slice(1) }), /backpack is accepted by the Curios back slot/);
  assert.throws(() => runCheck({ ...ALL, recipe: false }), /recipe is present/);
});
