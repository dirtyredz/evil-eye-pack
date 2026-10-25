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
test('registration gates the whole command tree at permission level two', () => {
  const ns = load(), nodes = {};
  const context = vm.createContext({ global: { evilEyeShowcase: ns }, ServerEvents: { commandRegistry(fn) {
    fn({ commands: { literal(name) {
      return nodes[name] = { requires(fn) { this.permission = fn; return this; }, then() { return this; }, executes(fn) { this.execute = fn; return this; } };
    } }, register() {} });
  } } });
  vm.runInContext(fs.readFileSync(path.join(scripts, 'command.js'), 'utf8'), context);
  assert.equal(nodes.evileye.permission({ hasPermission: n => n <= 1 }), false);
  assert.equal(nodes.evileye.permission({ hasPermission: n => n <= 2 }), true);
  assert.equal(typeof nodes.contraption_storage.execute, 'function');
  assert.equal(typeof nodes.list.execute, 'function');
  assert.ok(nodes.clear);
  let built;
  ns.build = (source, plan, origin) => { built = origin; };
  nodes.contraption_storage.execute({ source: {
    getPosition: () => ({ x: () => 100, y: () => 64, z: () => 200 }),
    getRotation: () => ({ y: 0 }), sendSuccess() {}, sendFailure() {},
  } });
  assert.equal(built.x, 88, 'Vec3 coordinate accessor methods must be called');
  assert.equal(built.y, 64); assert.equal(built.z, 204);
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
