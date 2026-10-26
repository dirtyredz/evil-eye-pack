'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mob = (type, extra = {}) => ({ getType: () => type, getX: () => 11, getY: () => 64, getZ: () => 21, hasCustomName: () => false, isAlive: () => true, discard() { this.gone = true; }, ...extra });

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
    if (name.endsWith('.Blocks')) return { AIR: { defaultBlockState: () => 'minecraft:air' }, STONE_BRICKS: { defaultBlockState: () => 'minecraft:stone_bricks' } };
    if (name.endsWith('.BlockStateParser')) return { parseForBlock(lookup, state) { if (state === 'missing:block') throw new Error('Unknown block'); } };
    return {};
  } };
  const context = vm.createContext({ global: {}, Java: java });
  for (const file of ['plan.js', 'entities.js', 'construction.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../kubejs/server_scripts/showcase', file), 'utf8'), context);
  const ns = context.global.evilEyeShowcase, plan = ns.plan(3, 3, 3);
  plan.block(1, 0, 1, 'minecraft:stone');
  const build = (o = origin, clear = false) => ns.build(source, plan, o, 'fixture', clear);
  return { ns, source, plan, origin, blocks, entities, writes, data, level, build, id };
}

test('unloaded, border, height, unknown-state and protected-entity refusals make no world or ownership writes', () => {
  const cases = [
    f => { f.level.hasChunkAt = () => false; },
    f => { f.level.getWorldBorder = () => ({ getMinX: () => 12, getMaxX: () => 30000000, getMinZ: () => -30000000, getMaxZ: () => 30000000 }); },
    f => { f.level.getMaxBuildHeight = () => 65; },
    f => { f.plan.blocks[0].state = 'missing:block'; },
    f => f.entities.push(mob('minecraft:player')),
    f => f.entities.push(mob('minecraft:cow', { hasCustomName: () => true, getCustomName: () => ({ getString: () => 'Bessie' }) })),
    f => f.entities.push(mob('minecraft:wolf', { getOwnerUUID: () => 'someone' })),
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

test('clear cannot claim terrain that was never a showcase', () => {
  const f = fixture(); assert.throws(() => f.build(f.origin, true), /No showcase/);
  assert.deepEqual(f.writes, []);
});

test('rebuild refuses players and glue crossing its boundary without changing blocks', () => {
  for (const entity of [
    mob('minecraft:player'),
    { getType: () => 'create:super_glue', hasCustomName: () => false, getBoundingBox: () => ({ minX: 9, minY: 64, minZ: 20, maxX: 11, maxY: 65, maxZ: 21 }) },
  ]) {
    const f = fixture(); f.build(); const count = f.writes.length;
    f.entities.push(entity); assert.throws(() => f.build());
    assert.equal(f.writes.length, count);
  }
});

test('rebuild recognizes KubeJS namespaced glue and removes it', () => {
  const f = fixture(); f.build();
  const glue = { getType: () => 'create:super_glue', hasCustomName: () => false, getBoundingBox: () => ({ minX: 10, minY: 64, minZ: 20, maxX: 11, maxY: 65, maxZ: 21 }), isAlive: () => true, discard() { f.entities.splice(f.entities.indexOf(this), 1); } };
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

test('a first build makes its own plot over uneven, occupied terrain without a flatness or occupancy check', () => {
  const f = fixture();
  f.blocks.set('11,64,21', 'minecraft:chest'); f.blocks.set('12,65,22', 'minecraft:oak_log'); f.blocks.set('10,63,20', 'minecraft:air'); f.blocks.set('9,64,20', 'minecraft:diamond_block');
  f.level.getFluidState = () => ({ isEmpty: () => false });
  f.build();
  assert.equal(f.blocks.get('12,65,22'), 'minecraft:air');
  assert.equal(f.blocks.get('10,63,20'), 'minecraft:stone_bricks');
  assert.equal(f.blocks.get('11,64,21'), 'minecraft:stone');
  assert.equal(f.blocks.get('9,64,20'), 'minecraft:diamond_block');
});

test('ordinary mobs and items are discarded and reported; protected entities refuse before any write', () => {
  const f = fixture();
  const slime = mob('minecraft:slime'), item = mob('minecraft:item');
  f.entities.push(slime, item);
  const result = f.build();
  assert.ok(slime.gone && item.gone);
  assert.equal(result.removed.total, 2);
  assert.equal(result.removed.summary, '1 minecraft:item, 1 minecraft:slime');
  const g = fixture(); g.entities.push(mob('minecraft:cow', { hasCustomName: () => true, getCustomName: () => ({ getString: () => 'Bessie' }) }), mob('minecraft:slime'));
  assert.throws(() => g.build(), /named minecraft:cow "Bessie" at 11, 64, 21.*Move it out/);
  assert.deepEqual(g.writes, []);
  assert.ok(!g.entities[1].gone);
});

test('an overlapping different showcase is replaced, not refused', () => {
  const f = fixture(); f.build();
  f.ns.build(f.source, f.plan, { x: 11, y: 64, z: 20 }, 'other', false);
  assert.deepEqual(Object.keys(JSON.parse(f.data.evilEyeShowcasePlots)), ['minecraft:overworld:11,64,20']);
});
