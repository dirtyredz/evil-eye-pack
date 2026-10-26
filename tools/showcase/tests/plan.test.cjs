const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scripts = path.resolve(__dirname, '../../../kubejs/server_scripts/showcase');
function load() {
  const context = vm.createContext({ global: {} });
  for (const file of ['plan.js', ...fs.readdirSync(path.join(scripts, 'sections')).filter(f => f.endsWith('.js')).sort().map(f => 'sections/' + f)]) vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
  return context.global.evilEyeShowcase;
}
test('the complete plot and swept payload fit the bounded clearing volume', () => {
  const ns = load(), p = ns.sections.contraption_storage();
  ns.validate(p);
  assert.ok(p.width * p.depth * (p.height + 1) < 32768);
  const occupied = new Set();
  for (const b of p.blocks) {
    const key = [b.x, b.y, b.z].join();
    assert.ok(!occupied.has(key), `duplicate placement ${key}`);
    occupied.add(key);
    assert.ok(b.x >= 0 && b.x < p.width && b.y >= -1 && b.y < p.height && b.z >= 0 && b.z < p.depth);
  }
  for (const f of p.fills) assert.ok(occupied.has([f.x, f.y, f.z].join()));
  assert.throws(() => p.block(24, 0, 0, 'minecraft:stone'), /outside bounds/);
  assert.ok(8 - 5 >= 0 && 8 + 5 < p.width && 16 - 5 >= 0 && 16 + 5 < p.depth);
});

test('section filenames match registration, and every factory returns a bounded plan', () => {
  const ns = load(), files = fs.readdirSync(path.join(scripts, 'sections')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
  assert.deepEqual(Object.keys(ns.sections).sort(), files);
  for (const name of files) ns.validate(ns.sections[name]());
});
test('all four drawer types repeat at measured distances, labelled two cells east facing north', () => {
  const p = load().sections.contraption_storage();
  for (const z of [8, 24, 48]) {
    for (const x of [2, 7, 12, 17]) {
      assert.ok(p.blocks.find(b => b.x === x && b.z === z && b.state.startsWith('storagedrawers:')));
      assert.ok(p.fills.find(f => f.x === x && f.z === z && f.items.length));
      const sign = p.blocks.find(b => b.x === x + 2 && b.z === z);
      assert.equal(sign.state, 'minecraft:oak_sign[rotation=8]');
      assert.ok(sign.nbt.includes(`${z}m from gold`));
    }
  }
});
test('the whole plot lies ahead for all cardinal headings, including negative yaw', () => {
  const ns = load(), p = ns.sections.contraption_storage();
  for (const yaw of [0, 360, -360]) assert.equal(ns.origin(0, 64, 0, yaw, p).z, 4);
  assert.ok(ns.origin(0, 64, 0, 90, p).x + p.width < 0);
  assert.ok(ns.origin(0, 64, 0, 180, p).z + p.depth < 0);
  assert.equal(ns.origin(0, 64, 0, -90, p).x, 4);
});
function loadCommand(ns) {
  const nodes = {};
  const node = name => ({ name, requires(fn) { this.permission = fn; return this; }, then(c) { return this; },
    executes(fn) { this.execute = fn; return this; }, suggests(fn) { this.suggest = fn; return this; } });
  const context = vm.createContext({ global: { evilEyeShowcase: ns }, console, Text: { of: s => s },
    Java: { loadClass: () => ({ greedyString: () => 'greedy', getString: (c, n) => { if (c.args === undefined) throw new Error('No such argument'); return c.args } }) },
    ServerEvents: { commandRegistry(fn) {
      fn({ commands: { literal: n => nodes[n] = node(n), argument: n => nodes[n] = node(n) }, register() {} });
    } } });
  vm.runInContext(fs.readFileSync(path.join(scripts, 'command.js'), 'utf8'), context);
  return nodes;
}
function fakeSource(x = 100, y = 64, z = 200, yaw = 0) {
  const log = { ok: [], fail: [] };
  return { log, hasPermission: n => n <= 2, getPosition: () => ({ x: () => x, y: () => y, z: () => z }), getRotation: () => ({ y: yaw }),
    sendSuccess(f) { log.ok.push(f()); }, sendFailure(m) { log.fail.push(m); } };
}
test('registration gates the whole command tree at permission level two', () => {
  const ns = load(), nodes = loadCommand(ns);
  assert.equal(nodes.evileye.permission({ hasPermission: n => n <= 1 }), false);
  assert.equal(nodes.evileye.permission({ hasPermission: n => n <= 2 }), true);
  assert.equal(typeof nodes.showcase.execute, 'function', 'bare /evileye showcase is executable');
  assert.equal(typeof nodes.args.execute, 'function');
  assert.equal(typeof nodes.args.suggest, 'function');
});
test('bare, named, clear, list and unknown forms (including trailing space) behave', () => {
  const ns = load(), nodes = loadCommand(ns), calls = [];
  ns.build = (source, plan, origin, name, clear) => { calls.push({ origin, name, clear }); };
  const source = fakeSource();
  assert.equal(nodes.showcase.execute({ source }), 1); assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'contraption_storage'); assert.equal(calls[0].origin.x, 88, 'Vec3 accessors called, centred on player');
  assert.equal(calls[0].origin.z, 204); assert.equal(calls[0].clear, false);
  const run = args => nodes.args.execute({ source, args });
  calls.length = 0;
  assert.equal(run('contraption_storage '), 1, 'trailing space tolerated');
  assert.equal(run('  Contraption_Storage'), 1, 'case-insensitive');
  assert.equal(calls.length, 2); assert.equal(calls[0].origin.x, 88);
  assert.equal(run('clear contraption_storage '), 1); assert.equal(calls[2].clear, true);
  assert.equal(run('clear'), 1); assert.equal(calls[3].clear, true);
  assert.equal(run('list'), 1); assert.match(source.log.ok.at(-1), /contraption_storage/);
  const before = calls.length;
  assert.equal(run('nope'), 0); assert.equal(run('a b'), 0); assert.equal(run('clear nope'), 0);
  assert.equal(calls.length, before, 'refusals build nothing');
  assert.match(source.log.fail[0], /unknown showcase "nope"\. Available: contraption_storage/);
});
test('several sections are laid side by side without overlap', () => {
  const ns = load(), nodes = loadCommand(ns), calls = [];
  ns.register('zz_second', () => ns.plan(10, 12, 4));
  ns.build = (source, plan, origin, name) => { calls.push({ origin, name, plan }); };
  assert.equal(nodes.showcase.execute({ source: fakeSource() }), 1);
  assert.deepEqual(calls.map(c => c.name), ['contraption_storage', 'zz_second']);
  assert.ok(calls[1].origin.x >= calls[0].origin.x + calls[0].plan.width + 8, 'gap between plots');
  assert.equal(calls[1].origin.z, calls[0].origin.z); assert.equal(calls[1].origin.y, calls[0].origin.y);
});
test('suggestions complete section names, list and clear', () => {
  const ns = load(), nodes = loadCommand(ns);
  const suggestions = remaining => { const got = []; const out = { suggest: s => got.push(s), buildFuture: () => got };
    nodes.args.suggest({}, { getRemaining: () => remaining, getStart: () => 0, createOffset: () => out }); return got; };
  assert.deepEqual(suggestions(''), ['list', 'clear', 'contraption_storage']);
  assert.deepEqual(suggestions('cont'), ['contraption_storage']);
  assert.deepEqual(suggestions('clear '), ['contraption_storage']);
});

test('registry rejects duplicate, reserved and unsafe command names', () => {
  const ns = load();
  for (const name of ['contraption_storage', 'list', 'clear', '../oops', '__proto__', 'constructor']) assert.throws(() => ns.register(name, () => {}));
  ns.register('future_section', () => ns.plan(4, 4, 4));
  assert.throws(() => ns.register('bad_factory', {}), /factory/);
  assert.equal(ns.sections.future_section().width, 4);
});

test('validation catches invalid dimensions and writes hidden in secondary descriptors', () => {
  const ns = load();
  for (const dimensions of [[0, 1, 1], [NaN, 1, 1], [1.5, 2, 3], [100, 100, 100]]) assert.throws(() => ns.validate(ns.plan(...dimensions)), /dimensions/);
  for (const corrupt of [
    p => p.blocks.push({ x: NaN, y: 0, z: 0 }),
    p => p.blocks.push({ ...p.blocks[0] }),
    p => p.fills.push({ x: 23, y: 7, z: 52, items: [] }),
    p => p.glue.push([0, 0, 0, 25, 1, 1]),
    p => p.motors[0].lever = [24, 1, 16],
    p => p.bearings.push([8, 8, 16]),
    p => p.fills[0].items[0][1] = -2,
    p => p.fills[0].items[0][0] = 'diamond; execute something',
  ]) {
    const p = ns.sections.contraption_storage(); corrupt(p); assert.throws(() => ns.validate(p));
  }
});

test('plans are fresh per invocation and lever starts off', () => {
  const ns = load(), a = ns.sections.contraption_storage(), b = ns.sections.contraption_storage();
  a.fills[0].items[0][1] = 1;
  assert.equal(b.fills[0].items[0][1], 64);
  assert.ok(b.blocks.some(x => x.state === 'minecraft:lever[face=floor,facing=north,powered=false]'));
  assert.equal(b.motors[0].speed, 2);
});
