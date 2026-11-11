'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { candidateCollector } = require('../probe/candidates.cjs');
const { inventory } = require('../../../data_io/world/inventory.cjs');

const section = names => ({ Y: 0, block_states: { palette: names.map(Name => ({ Name })) } });

test('candidate targets carry player, spawn, entity, block entity and port block reasons', () => {
  const c = candidateCollector();
  c.visit({ Data: { SpawnX: 33, SpawnZ: -1, Player: { Pos: [17, 64, 0], Dimension: 'minecraft:the_nether' } } }, { file: 'level.dat' });
  c.visit({ Entities: [{ id: 'x' }], block_entities: [{ id: 'y' }], sections: [section(['alexscaves:tree'])] },
    { file: 'r', dimension: 'minecraft:overworld', chunk: [1, 2] });
  c.visit({ sections: [section(['create:cog'])] }, { file: 'r', dimension: 'minecraft:overworld', chunk: [9, 9] });
  assert.deepEqual(c.targets(), [
    { dimension: 'minecraft:overworld', x: 1, z: 2, reasons: ['entity', 'block entity', 'port blocks'] },
    { dimension: 'minecraft:overworld', x: 2, z: -1, reasons: ['spawn'] },
    { dimension: 'minecraft:the_nether', x: 1, z: 0, reasons: ['player'] }
  ]);
});

test('every ported-mod namespace marks port blocks and a malformed palette keeps earlier targets', () => {
  const c = candidateCollector();
  ['iceandfire', 'roundwood', 'ars_instrumentum', 'alexsmobs', 'alexscaves'].forEach((ns, i) =>
    c.visit({ sections: [section([ns + ':b'])] }, { file: 'r', dimension: 'minecraft:overworld', chunk: [i, 0] }));
  assert.equal(c.targets().filter(t => t.reasons.includes('port blocks')).length, 5);
  const bad = candidateCollector();
  bad.visit({ Entities: [{}], sections: [{ Y: 0, block_states: { palette: [{ Name: 'a:b' }], data: [1] } }] },
    { file: 'r', dimension: 'minecraft:overworld', chunk: [0, 0] });
  assert.ok(bad.targets()[0].reasons.includes('entity'));
});

test('the inventory reader exposes no target policy and the collector rides its visit hook', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'candidates-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const c = candidateCollector();
  assert.equal('targets' in inventory(dir, { visit: c.visit }), false);
  assert.deepEqual(c.targets(), []);
});
