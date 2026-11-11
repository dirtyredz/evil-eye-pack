'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const png = require('../png.cjs');
const { KINDS, NS, piecedSheet } = require('../generate.cjs');

const ASSETS = path.resolve(__dirname, '..', '..', '..', '..', 'resourcepacks', 'evil-eye-cozy-overrides', 'assets');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ASSETS, rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(ASSETS, rel));
const modelFile = (id) => { const [ns, p] = id.split(':'); return `${ns}/models/${p}.json`; };

test('17 glass kinds: vanilla glass plus the 16 stained colours, each with a pane', () => {
  assert.equal(KINDS.length, 17);
  assert.equal(new Set(KINDS.map((k) => k.block)).size, 17);
});

test('every pieced texture is an 80x16 five-tile sheet with the Fusion pieced mcmeta', () => {
  for (const k of KINDS) {
    const img = png.readFile(path.join(ASSETS, NS, 'textures', 'block', `${k.block}.png`));
    assert.deepEqual([img.w, img.h], [80, 16], k.block);
    assert.deepEqual(readJson(`${NS}/textures/block/${k.block}.png.mcmeta`), { fusion: { type: 'connecting', layout: 'pieced' } });
    // Tile 1 (all sides connected) is one flat fill, so a wall shows no frame at all.
    const t1 = new Set();
    for (let y = 0; y < 16; y++) for (let x = 16; x < 32; x++) t1.add(img.data.subarray((y * 80 + x) * 4, (y * 80 + x) * 4 + 4).toString('hex'));
    assert.equal(t1.size, 1, `${k.block} centre tile is flat`);
  }
});

test('piecedSheet frames: tile 2 has left/right frame only, tile 3 top/bottom only, tile 4 corners only', () => {
  const v = { w: 16, h: 16, data: Buffer.alloc(16 * 16 * 4) };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const edge = x === 0 || x === 15 || y === 0 || y === 15;
    v.data.set(edge ? [200, 10, 10, 255] : [0, 0, 0, 0], (y * 16 + x) * 4);
  }
  const s = piecedSheet(v);
  const a = (tile, x, y) => s.data[(y * 80 + tile * 16 + x) * 4 + 3];
  assert.equal(a(0, 5, 0), 255); assert.equal(a(1, 0, 0), 0);
  assert.equal(a(2, 0, 8), 255); assert.equal(a(2, 8, 0), 0);
  assert.equal(a(3, 8, 0), 255); assert.equal(a(3, 0, 8), 0);
  assert.equal(a(4, 15, 15), 255); assert.equal(a(4, 8, 0), 0); assert.equal(a(4, 0, 8), 0);
});

test('every block model is a Fusion connecting model and every referenced model or texture exists', () => {
  for (const k of KINDS) {
    const bs = readJson(`minecraft/blockstates/${k.block}.json`);
    assert.equal(bs.variants[''].model, `${NS}:block/${k.block}`);
    const full = readJson(`${NS}/models/block/${k.block}.json`);
    assert.equal(full.loader, 'fusion:model');
    assert.equal(full.type, 'fusion:connecting');
    assert.equal(full.textures.all, `${NS}:block/${k.block}`);

    const pane = readJson(`minecraft/blockstates/${k.pane}.json`);
    assert.equal(pane.multipart.length, 9);
    for (const part of pane.multipart) {
      assert.ok(exists(modelFile(part.apply.model)), part.apply.model);
      const m = readJson(modelFile(part.apply.model));
      assert.equal(m.loader, 'fusion:model');
      assert.equal(m.type, 'fusion:connecting');
      assert.equal(m.textures.pane, `${NS}:block/${k.block}`);
      assert.equal(m.textures.edge, `minecraft:block/${k.pane}_top`);
      assert.ok(m.parent.startsWith('minecraft:block/template_glass_pane_'), m.parent);
    }
  }
});

test('pane side arms connect on their own side property and only for their own pane block', () => {
  for (const k of KINDS) for (const dir of ['north', 'east', 'south', 'west']) {
    const m = readJson(`${NS}/models/block/${k.pane}_side_${dir}.json`);
    const match = m.connections.predicates.find((p) => p.type === 'fusion:match_state');
    assert.equal(match.block, `minecraft:${k.pane}`);
    assert.deepEqual(match.properties, { [dir]: ['true'] });
  }
});

test('the pane culling fix targets all 17 panes', () => {
  const mod = readJson(`${NS}/fusion/model_modifiers/blocks/pane_culling_fix.json`);
  assert.equal(mod.pane_culling_fix, true);
  assert.deepEqual([...mod.targets].sort(), KINDS.map((k) => `minecraft:${k.pane}`).sort());
});

test('no Connected Glass id remains in the shipped resources', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(ASSETS).filter((p) => /\.(json|mcmeta)$/.test(p))) {
    assert.ok(!/connectedglass/i.test(fs.readFileSync(f, 'utf8')), f);
  }
});
