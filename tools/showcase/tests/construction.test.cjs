'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
  const blocks = new Map(), entities = [], writes = [], data = {};
  const origin = { x: 10, y: 64, z: 20 };
  class Pos { constructor(x, y, z) { Object.assign(this, { x, y, z }); } }
  class Box { constructor(minX, minY, minZ, maxX, maxY, maxZ) { Object.assign(this, { minX, minY, minZ, maxX, maxY, maxZ }); } }
  const key = p => [p.x, p.y, p.z].join();
  const id = p => blocks.get(key(p)) || (p.y === 63 ? 'minecraft:dirt' : 'minecraft:air');
  const level = {
    dimension: 'minecraft:overworld', getMinBuildHeight: () => -64, getMaxBuildHeight: () => 320,
    hasChunkAt: () => true, getWorldBorder: () => ({ getMinX: () => -30000000, getMaxX: () => 30000000, getMinZ: () => -30000000, getMaxZ: () => 30000000, isWithinBounds() { throw new Error('Rhino ambiguous overload'); } }), holderLookup: () => ({}),
    getBlockState: p => ({ isFaceSturdy: () => id(p) !== 'minecraft:air', isAir: () => id(p) === 'minecraft:air', canBeReplaced: () => false }),
    getFluidState: () => ({ isEmpty: () => true }), getBlockEntity: () => null,
    setBlock: (p, state, flags) => { assert.equal(flags, 50); writes.push('bounded clear ' + key(p)); blocks.set(key(p), state); return true; },
    getEntities: () => ({ size: () => entities.length, get: i => entities[i] }),
  };
  const server = {
    persistentData: { getString: k => data[k] || '', putString: (k, v) => { data[k] = v; } },
    getCommands: () => ({ performPrefixedCommand(source, cmd) {
      writes.push(cmd);
      const [verb, ...args] = cmd.split(' ');
      const a = args.slice(0, 3).map(Number), b = verb === 'fill' ? args.slice(3, 6).map(Number) : a;
      const state = args[verb === 'fill' ? 6 : 3];
      for (let x = a[0]; x <= b[0]; x++) for (let y = a[1]; y <= b[1]; y++) for (let z = a[2]; z <= b[2]; z++) blocks.set([x, y, z].join(), state);
      return 1;
    } }),
  };
  const source = { getLevel: () => level, getServer: () => server, withSuppressedOutput() { return this; } };
  const java = { loadClass(name) {
    if (name.endsWith('.BlockPos')) return Pos;
    if (name.endsWith('.AABB')) return Box;
    if (name.endsWith('.Blocks')) return { AIR: { defaultBlockState: () => 'minecraft:air' } };
    if (name.endsWith('.BlockStateParser')) return { parseForBlock(lookup, state) { if (state === 'missing:block') throw new Error('Unknown block'); } };
    return {};
  } };
  const context = vm.createContext({ global: {}, Java: java });
  for (const file of ['plan.js', 'construction.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../kubejs/server_scripts/showcase', file), 'utf8'), context);
  const ns = context.global.evilEyeShowcase, plan = ns.plan(3, 3, 3);
  plan.block(1, 0, 1, 'minecraft:stone');
  const build = (o = origin, clear = false) => ns.build(source, plan, o, 'fixture', clear);
  return { ns, plan, origin, blocks, entities, writes, data, level, build, id };
}

test('occupied, unloaded, border, height and unknown-state refusals make no world or ownership writes', () => {
  const cases = [
    f => f.blocks.set('11,64,21', 'minecraft:chest'),
    f => { f.level.hasChunkAt = () => false; },
    f => { f.level.getWorldBorder = () => ({ getMinX: () => 12, getMaxX: () => 30000000, getMinZ: () => -30000000, getMaxZ: () => 30000000 }); },
    f => { f.level.getMaxBuildHeight = () => 65; },
    f => { f.plan.blocks[0].state = 'missing:block'; },
    f => f.entities.push({ getType: () => 'minecraft:player', getX: () => 11, getY: () => 64, getZ: () => 21 }),
  ];
  for (const change of cases) {
    const f = fixture(); change(f);
    assert.throws(() => f.build());
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.data, {});
  }
});

test('a reserved plot rebuilds and clears while its outside sentinel survives', () => {
  const f = fixture(); f.blocks.set('9,64,20', 'minecraft:diamond_block');
  f.build();
  assert.equal(f.blocks.get('11,64,21'), 'minecraft:stone');
  f.blocks.set('11,64,21', 'minecraft:gold_block');
  f.build();
  assert.equal(f.blocks.get('11,64,21'), 'minecraft:stone');
  f.build(f.origin, true);
  assert.equal(f.blocks.get('11,64,21'), 'minecraft:air');
  assert.equal(f.blocks.get('11,63,21'), 'minecraft:stone_bricks');
  assert.equal(f.blocks.get('9,64,20'), 'minecraft:diamond_block');
  assert.deepEqual(JSON.parse(f.data.evilEyeShowcasePlots), {});
});

test('clear cannot claim an arbitrary occupied plot; overlapping reserved plots are rejected', () => {
  const f = fixture(); assert.throws(() => f.build(f.origin, true), /No showcase/);
  f.build(); const count = f.writes.length;
  assert.throws(() => f.build({ x: 11, y: 64, z: 20 }), /Overlaps/);
  assert.equal(f.writes.length, count);
});

test('rebuild refuses unrelated entities and glue crossing its boundary without changing blocks', () => {
  for (const entity of [
    { getType: () => 'minecraft:player', getX: () => 11, getY: () => 64, getZ: () => 21 },
    { getType: () => 'create:super_glue', getBoundingBox: () => ({ minX: 9, minY: 64, minZ: 20, maxX: 11, maxY: 65, maxZ: 21 }) },
  ]) {
    const f = fixture(); f.build(); const count = f.writes.length;
    f.entities.push(entity); assert.throws(() => f.build());
    assert.equal(f.writes.length, count);
  }
});

test('rebuild recognizes KubeJS namespaced glue and removes it', () => {
  const f = fixture(); f.build();
  const glue = { getType: () => 'create:super_glue', getBoundingBox: () => ({ minX: 10, minY: 64, minZ: 20, maxX: 11, maxY: 65, maxZ: 21 }), isAlive: () => true, discard() { f.entities.splice(f.entities.indexOf(this), 1); } };
  f.entities.push(glue); f.build();
  assert.equal(f.entities.length, 0);
});

test('rebuild removes inventory block entities before replacement can drop their contents', () => {
  const f = fixture(); f.build(); let removed = false;
  f.level.getBlockEntity = p => p.x === 11 && p.y === 64 && p.z === 21 && !removed ? {} : null;
  f.level.removeBlockEntity = p => { assert.deepEqual([p.x, p.y, p.z], [11, 64, 21]); removed = true; };
  const originalSet = f.blocks.set.bind(f.blocks);
  f.blocks.set = (key, value) => { if (key === '11,64,21' && value === 'minecraft:air') assert.ok(removed, 'inventory must be detached before air replaces its block'); return originalSet(key, value); };
  f.build(); assert.ok(removed);
});

test('rebuild uses a clear pass that suppresses support updates and drops', () => {
  const f = fixture(); f.build(); f.build();
  assert.ok(f.writes.some(w => w.startsWith('bounded clear ')));
  assert.ok(!f.writes.some(w => w.startsWith('fill ') && w.endsWith('minecraft:air')));
});
