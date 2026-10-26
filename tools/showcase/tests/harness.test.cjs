'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const production = f => fs.readFileSync(path.join(__dirname, '../../../kubejs/server_scripts/showcase', f), 'utf8');

test('extracted helpers use configured floor, relative coordinates and real command source', () => {
  class Pos { constructor(x, y, z) { Object.assign(this, { x, y, z }); } }
  const ctx = vm.createContext({ global: { evilEyeShowcase: { FLOOR: 'fixture:floor' } }, Java: { loadClass: n => n.endsWith('.BlockPos') ? Pos : { ITEM_HANDLER: 'item' } } });
  vm.runInContext(script('helpers.js'), ctx);
  const origin = { x: 10, y: 20, z: 30 }, checks = [], commands = [], states = new Map();
  const source = {}, handler = { getSlots: () => 1, getStackInSlot: () => ({ getId: () => 'fixture:item', getCount: () => 7 }) };
  const be = { getCapability: c => { assert.equal(c, 'item'); return { orElse: () => handler }; }, saveWithFullMetadata: () => 'nbt' };
  const h = ctx.global.evilEyeShowcaseMakeHelpers({ origin, name: 'fixture', source, plan: { width: 1, depth: 1, height: 1, blocks: [], fills: [] },
    check: (ok, message) => { checks.push(message); assert.ok(ok, message); },
    level: { getBlockEntity: () => be, getBlockState: p => states.get([p.x, p.y, p.z].join()) || (p.y === 19 ? 'fixture:floor' : 'minecraft:air') },
    server: { runCommandSilent: s => commands.push(s), getCommands: () => ({ performPrefixedCommand: (who, s) => { assert.equal(who, source); commands.push(s); return 1; } }) },
  });
  assert.deepEqual([h.pos(1, 2, 3).x, h.pos(1, 2, 3).y, h.pos(1, 2, 3).z], [11, 22, 33]);
  assert.equal(h.be(0, 0, 0), be); assert.equal(h.handler(0, 0, 0), handler); assert.equal(h.amount(handler, 'fixture:item'), 7);
  h.verifyPlan(); h.verifyVolume(true); assert.equal(checks.length, 2);
  h.set(1, 2, 3, 'minecraft:stone'); h.invoke(); h.invoke(null, true);
  assert.deepEqual(commands, ['setblock 11 22 33 minecraft:stone', 'evileye showcase fixture', 'evileye showcase clear fixture']);
  const before = h.shell(); states.set('9,20,30', 'minecraft:gold_block'); assert.notEqual(h.shell(), before);
});

test('shared command forms cover several registry sections with distinct row origins', () => {
  class Vec3 { constructor(x, y, z) { this.xyz = [x, y, z]; } x() { return this.xyz[0]; } y() { return this.xyz[1]; } z() { return this.xyz[2]; } }
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; } }
  let execute;
  const node = () => ({ requires() { return this; }, then() { return this; }, suggests() { return this; }, executes(fn) { execute = fn; return this; } });
  const ctx = vm.createContext({ global: {}, console: { info() {} }, Text: { of: x => x },
    Java: { loadClass: n => n.endsWith('.Vec3') ? Vec3 : n.endsWith('.Vec2') ? Vec2 : { greedyString: () => '', getString: c => c.args } },
    ServerEvents: { commandRegistry: fn => fn({ commands: { literal: node, argument: node }, register() {} }) },
  });
  vm.runInContext(production('plan.js'), ctx);
  const ns = ctx.global.evilEyeShowcase, records = {}, verified = [], cleared = [], assertions = [];
  for (const [i, name] of ['alpha', 'beta', 'gamma'].entries()) ns.register(name, () => ns.plan(3 + i, 4 + i, 2));
  ns.records = () => records;
  ns.build = (source, plan, o, name, clear) => {
    const key = [o.x, o.y, o.z].join();
    if (clear) { if (!records[key]) throw new Error('No showcase'); delete records[key]; }
    else records[key] = { name };
    return { removed: { total: 0, summary: '' } };
  };
  vm.runInContext(production('command.js'), ctx);
  const source = (at = new Vec3(0, 0, 0), permission = 2) => ({ getPosition: () => at, getRotation: () => ({ y: 0 }), withPosition: p => source(p, permission), withRotation() { return this; }, withPermission: p => source(at, p), hasPermission: n => permission >= n, sendSuccess() {}, sendFailure() {} });
  const server = { createCommandSourceStack: () => source(), getCommands: () => ({ performPrefixedCommand: (who, text) => who.hasPermission(2) ? execute({ source: who, args: text.slice('evileye showcase'.length) }) : 0 }) };
  ctx.global.evilEyeShowcaseMakeHelpers = h => {
    const key = [h.origin.x, h.origin.y, h.origin.z].join();
    return Object.assign(h, { prepareTerrain() {}, shell: () => 'outside',
      invoke: who => server.getCommands().performPrefixedCommand(who, 'evileye showcase ' + h.name),
      verifyPlan() { assert.equal(records[key]?.name, h.name); verified.push(h.name); },
      verifyVolume() { assert.equal(records[key], undefined); cleared.push(h.name); },
    });
  };
  vm.runInContext(script('command_forms.js'), ctx);
  let done = 0;
  ctx.global.evilEyeShowcaseCommandForms({ server, level: {}, check: (ok, message) => { assertions.push(message); assert.ok(ok, message); }, later: (ticks, fn) => fn(), done: () => done++ });
  assert.equal(done, 1); assert.equal(verified.length, 6); assert.equal(cleared.length, 6); assert.deepEqual(records, {});
  assert.equal(assertions.filter(x => x.startsWith('permission level 1')).length, 3);
});

test('harness calls the shared command check exactly once after selected sections', () => {
  let loaded, complete = 0; const visited = [];
  class Vector { constructor() {} }
  const source = { withPosition() { return this; }, withRotation() { return this; }, withPermission() { return this; } };
  const globals = { evilEyeShowcase: { sections: {} }, evilEyeShowcaseCheckSelection: ['alpha', 'beta'], evilEyeShowcaseChecks: {},
    evilEyeShowcaseMakeHelpers: h => Object.assign(h, { cmd() {}, prepareTerrain() {} }),
    evilEyeShowcaseCommandForms: h => { visited.push('shared'); h.done(); } };
  for (const name of globals.evilEyeShowcaseCheckSelection) {
    globals.evilEyeShowcase.sections[name] = () => ({ width: 3 });
    globals.evilEyeShowcaseChecks[name] = h => { visited.push(name); h.done(); };
  }
  const ctx = vm.createContext({ global: globals, Java: { loadClass: () => Vector }, ServerEvents: { loaded: fn => { loaded = fn; } }, console: { info: s => { if (s.startsWith('SHOWCASE_CHECK COMPLETE')) complete++; } } });
  vm.runInContext(script('harness.js'), ctx);
  loaded({ server: { overworld: () => ({}), createCommandSourceStack: () => source, scheduleInTicks: (ticks, fn) => fn() } });
  assert.deepEqual(visited, ['alpha', 'beta', 'shared']); assert.equal(complete, 1);
});
