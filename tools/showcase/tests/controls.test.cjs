'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(legacy = false) {
  let tick, speed = 0, powered = true, loaded = true, present = true;
  const calls = [];
  class Pos { constructor(x, y, z) { Object.assign(this, { x, y, z }); } }
  const ctx = vm.createContext({ global: {}, ServerEvents: { tick: fn => { tick = fn; } }, Java: { loadClass(name) {
    if (name.endsWith('.BlockPos') || name.endsWith('.AABB')) return Pos;
    if (name.endsWith('.Shapes')) return { empty: () => ({}), joinUnoptimized: () => { calls.push('collision'); return {}; } };
    return { OR: 'or' };
  } } });
  for (const f of ['plan.js', 'rigs/create_contraption.js', 'plots.js', 'controls.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../../kubejs/server_scripts/showcase', f), 'utf8'), ctx);
  const ns = ctx.global.evilEyeShowcase;
  const descriptor = ns.createContraption();
  descriptor.glue.push([2, 0, 0, 3, 1, 1]);
  descriptor.motors.push({ x: 0, y: 0, z: 0, speed: 2, lever: [1, 0, 0] });
  const record = { name: 'removed_section', dimension: 'overworld', origin: { x: 10, y: 64, z: 20 }, width: 3, depth: 3, height: 3, rig: descriptor };
  if (legacy) { record.motors = descriptor.motors; delete record.rig; }
  const level = {
    hasChunkAt: () => loaded,
    getEntities: () => ({ size: () => 1, get: () => ({ getType: () => 'create:super_glue', getBoundingBox: () => ({ minX: 12, minY: 64, minZ: 20, maxX: 13, maxY: 65, maxZ: 21 }) }) }),
    getBlockState: p => ({ toString: () => p.x === 10 ? 'create:creative_motor' : 'minecraft:lever[powered=' + powered + ']', getCollisionShape: () => { assert.equal(p.x, 12); return { move: () => ({}) }; } }),
    getBlockEntity: () => present ? { generatedSpeed: { getValue: () => speed, setValue: v => { calls.push('speed ' + v); speed = v; } } } : null,
  };
  const server = { tickCount: 5, getLevel: () => level, persistentData: { getString: () => JSON.stringify({ plot: record }) } };
  // Any access to the section registry is a regression, including an existing factory.
  Object.defineProperty(ns, 'sections', { get() { throw new Error('Controller accessed section registry'); } });
  return { ns, record, server, calls, tick: () => tick({ server }), speed: () => speed, powered: v => { powered = v; }, loaded: v => { loaded = v; }, present: v => { present = v; } };
}

for (const legacy of [false, true]) test('controller uses persisted ' + (legacy ? 'legacy motors' : 'rig') + ' after section removal', () => {
  const f = fixture(legacy);
  f.tick(); assert.equal(f.speed(), 2); assert.deepEqual(f.calls, ['collision', 'speed 2']);
  f.tick(); assert.equal(f.calls.length, 2, 'unchanged motor does not repeat collision work');
  f.powered(false); f.tick(); assert.equal(f.speed(), 0); assert.equal(f.calls.at(-1), 'speed 0');
});

test('controller skips unavailable levels, chunks, removed motors and non-control ticks', () => {
  const f = fixture();
  f.server.tickCount = 4; f.tick(); assert.deepEqual(f.calls, []);
  f.server.tickCount = 5; f.loaded(false); f.tick(); assert.deepEqual(f.calls, []);
  f.loaded(true); f.present(false); f.tick(); assert.deepEqual(f.calls, []);
  f.present(true); f.server.getLevel = () => null; f.tick(); assert.deepEqual(f.calls, []);
});

test('absent and unavailable rig implementations are harmless on ticks', () => {
  const f = fixture(); delete f.record.rig; f.tick(); assert.deepEqual(f.calls, []);
  f.record.rig = { type: 'removed_rig' }; f.tick(); assert.deepEqual(f.calls, []);
});
