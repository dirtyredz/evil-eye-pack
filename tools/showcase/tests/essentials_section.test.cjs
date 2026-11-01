'use strict';
// Evil Eye Essentials showcase (wave 5): production layout and the check's command sequence, without a server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = path.resolve(__dirname, '../../../kubejs/server_scripts/showcase');
function load() {
  const context = vm.createContext({ global: {} });
  for (const file of ['plan.js', 'rigs/create_contraption.js', 'sections/evileye_essentials.js']) vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
  return context.global.evilEyeShowcase;
}
const at = (p, x, y, z) => p.blocks.find((b) => b.x === x && b.y === y && b.z === z);
const signText = (b) => [...b.nbt.matchAll(/\\"text\\":\\"([^\\]*)\\"/g)].map((m) => m[1]).join(' ');

test('the section is static, vanilla-only, at least the hostile-terrain size, and labels every command group', () => {
  const ns = load(), p = ns.validate(ns.sections.evileye_essentials());
  assert.ok(p.width >= 24 && p.depth >= 22, 'the shared terrain check builds up to 24 x 22');
  assert.equal(p.rig, null);
  assert.equal(p.fills.length, 0);
  for (const b of p.blocks) assert.ok(b.state.startsWith('minecraft:'), `${b.state} is vanilla (Essentials adds no blocks)`);
  const text = p.blocks.filter((b) => b.state.startsWith('minecraft:oak_sign')).map(signText).join(' | ');
  for (const command of ['/sethome', '/home', '/back', '/spawn', '/tpa', '/warp', '/setwarp', '/trashcan', '/heal', '/kit']) {
    assert.ok(text.includes(command), `a label names ${command}`);
  }
  assert.match(text, /sidebar/i, 'a label points the owner at the inventory sidebar');
  assert.equal(at(p, 2, 0, 5).state, 'minecraft:lodestone', 'the home pad the check stands on');
  assert.equal(at(p, 2, 0, 14).state, 'minecraft:crying_obsidian', 'the warp pad the check stands on');
});

test('the check builds, exercises homes, /back, warps and the trash can as a fake player, then clears', () => {
  const ns = { checks: {}, terrain() {}, runCommand: (_server, source, text) => source.run(text) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../checks/evileye_essentials.js'), 'utf8'), {
    global: { evilEyeShowcaseCheck: ns },
    Java: { loadClass: (n) => n.endsWith('FakePlayerFactory') ? { get: () => player } : n.endsWith('UUID') ? { fromString: (x) => x } : function () {} }
  });
  const ran = [], checks = [], queue = [];
  let homes = 0, cooled = false, done = false, cleared = false;
  const menu = {}, inventory = {};
  const results = { 'sethome showcase': () => (homes++, 1), 'home showcase': () => (cooled ? 0 : (cooled = true, 1)), back: () => 1,
    'delhome showcase': () => (homes ? (homes--, 1) : 0), 'warp showcase': () => 1, trashcan: () => (player.containerMenu = menu, 1) };
  const source = (op) => ({ withSuppressedOutput: () => source(op), withPermission: () => source(true),
    run: (text) => { ran.push((op ? 'op ' : '') + text); if (/^(setwarp|delwarp)/.test(text)) return op ? 1 : 0; return results[text] ? results[text]() : 0; } });
  const player = { setPos() {}, createCommandSourceStack: () => source(false), inventoryMenu: inventory, containerMenu: inventory,
    closeContainer: () => { player.containerMenu = inventory; } };
  const commands = new Set(['home', 'sethome', 'delhome', 'listhomes', 'back', 'spawn', 'tpa', 'tpaccept', 'warp', 'setwarp', 'kit', 'trashcan',
    'heal', 'feed', 'fly', 'god', 'invsee', 'enderchest', 'nickname', 'mute', 'evileye_essentials']);
  ns.checks.evileye_essentials({
    check: (ok, message) => { assert.ok(ok, message); checks.push(message); }, later: (ticks, fn) => queue.push(fn),
    server: { getCommands: () => ({ getDispatcher: () => ({ getRoot: () => ({ getChild: (n) => commands.has(n) ? {} : null }) }) }) },
    level: {}, pos: () => ({ getX: () => 0, getY: () => 0, getZ: () => 0 }), shell: () => 'same',
    invoke: (_who, clear) => { if (clear) cleared = true; return 1; }, verifyPlan() {}, verifyVolume() {},
    run: (text) => (assert.equal(text, 'evileye_essentials import ftb dry_run'), 1), done: () => { done = true; }
  });
  while (queue.length) queue.shift()();
  assert.equal(done, true);
  assert.equal(cleared, true);
  assert.equal(homes, 0, 'the check removes its home');
  assert.deepEqual(ran.filter((t) => t.includes('warp')), ['setwarp showcase', 'op setwarp showcase', 'warp showcase', 'op delwarp showcase']);
  assert.ok(checks.includes('the 60 s /home cooldown applies'));
  assert.ok(ran.includes('trashcan'), 'the trash can command runs');
});

test('a missing Essentials command fails the check', () => {
  const ns = { checks: {}, terrain() {}, runCommand: () => 1 };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../checks/evileye_essentials.js'), 'utf8'), {
    global: { evilEyeShowcaseCheck: ns }, Java: { loadClass: () => function () {} }
  });
  assert.throws(() => ns.checks.evileye_essentials({
    check: (ok, message) => assert.ok(ok, message), later() {},
    server: { getCommands: () => ({ getDispatcher: () => ({ getRoot: () => ({ getChild: (n) => n === 'home' ? null : {} }) }) }) },
    level: {}, shell: () => 'same', invoke: () => 1, verifyPlan() {}, run: () => 1, done() {}
  }), /registers \/home/);
});
