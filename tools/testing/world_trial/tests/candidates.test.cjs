'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { candidateCollector } = require('../probe/candidates.cjs');
const { inventory } = require('../../../data_io/world/inventory.cjs');


test('candidate targets carry player, spawn, entity, block entity and port block reasons', () => {
  const c = candidateCollector();
  c.visit({ Data: { SpawnX: 33, SpawnZ: -1, Player: { Pos: [17, 64, 0], Dimension: 'minecraft:the_nether' } } }, { file: 'level.dat' });
  c.visit({ Entities: [{ id: 'x' }], block_entities: [{ id: 'y' }] },
    { file: 'r', dimension: 'minecraft:overworld', chunk: [1, 2], blockIds: new Set(['alexscaves:tree']) });
  c.visit({}, { file: 'r', dimension: 'minecraft:overworld', chunk: [9, 9], blockIds: new Set(['create:cog']) });
  assert.deepEqual(c.targets(), [
    { dimension: 'minecraft:overworld', x: 1, z: 2, reasons: ['entity', 'block entity', 'port blocks'] },
    { dimension: 'minecraft:overworld', x: 2, z: -1, reasons: ['spawn'] },
    { dimension: 'minecraft:the_nether', x: 1, z: 0, reasons: ['player'] }
  ]);
});

test('every ported-mod namespace marks port blocks and a chunk without decoded ids keeps earlier targets', () => {
  const c = candidateCollector();
  ['iceandfire', 'roundwood', 'ars_instrumentum', 'alexsmobs', 'alexscaves'].forEach((ns, i) =>
    c.visit({}, { file: 'r', dimension: 'minecraft:overworld', chunk: [i, 0], blockIds: [ns + ':b'] }));
  assert.equal(c.targets().filter(t => t.reasons.includes('port blocks')).length, 5);
  const bad = candidateCollector();
  bad.visit({ Entities: [{}] }, { file: 'r', dimension: 'minecraft:overworld', chunk: [0, 0], blockIds: new Set() });
  assert.ok(bad.targets()[0].reasons.includes('entity'));
});

test('the inventory reader exposes no target policy and the collector rides its visit hook', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'candidates-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const c = candidateCollector();
  assert.equal('targets' in inventory(dir, { visit: c.visit }), false);
  assert.deepEqual(c.targets(), []);
});

test('inventory decodes each chunk palette once and hands the block ids to the visit hook', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'candidates-region-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const str = s => { const b = Buffer.from(s), n = Buffer.alloc(2); n.writeUInt16BE(b.length); return Buffer.concat([n, b]); };
  const int = n => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
  const named = (type, name, body) => Buffer.concat([Buffer.from([type]), str(name), body]);
  const list = (type, items) => Buffer.concat([Buffer.from([type]), int(items.length), ...items]);
  const end = Buffer.from([0]);
  const palette = name => named(9, 'palette', list(10, [Buffer.concat([named(8, 'Name', str(name)), end])]));
  const sectionNbt = name => Buffer.concat([named(10, 'block_states', Buffer.concat([palette(name), end])), end]);
  const chunk = Buffer.concat([named(9, 'sections', list(10, [sectionNbt('create:cog'), sectionNbt('iceandfire:dragon_bone')])), end]);
  const payload = Buffer.concat([Buffer.from([3]), Buffer.from([10, 0, 0]), chunk]);
  const region = Buffer.alloc(8192 + 4096);
  region.writeUInt32BE((2 << 8) | 1, 0);
  region.writeUInt32BE(payload.length, 8192);
  payload.copy(region, 8196);
  fs.mkdirSync(path.join(dir, 'region'));
  fs.writeFileSync(path.join(dir, 'region', 'r.0.0.mca'), region);
  const c = candidateCollector(); let seen;
  const result = inventory(dir, { visit(v, context) { if (context.chunk) seen = [...context.blockIds]; c.visit(v, context); } });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(seen, ['create:cog', 'iceandfire:dragon_bone']);
  assert.deepEqual(c.targets(), [{ dimension: 'minecraft:overworld', x: 0, z: 0, reasons: ['port blocks'] }]);
});
