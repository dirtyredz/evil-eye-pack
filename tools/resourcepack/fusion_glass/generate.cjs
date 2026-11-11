#!/usr/bin/env node
'use strict';
/**
 * Generates the Fusion connected-glass resources inside resourcepacks/evil-eye-cozy-overrides.
 *
 * Vanilla glass, the 16 stained glasses and their panes get Fusion "connecting" models (Fusion 1.3.16,
 * the mod that ships in the pack). Nothing is copied from Connected Glass: each pieced 5-tile texture
 * is derived from vanilla's own glass texture (read from the Minecraft client jar), and the model
 * JSON is written here. Tinted glass is not touched: its texture has no frame, so it has no seams.
 *
 * Usage: node tools/resourcepack/fusion_glass/generate.cjs [--client-jar <minecraft-1.21.1-client.jar>]
 * Runs from any directory. Ends with OK or FAILED and the exit code.
 */
const fs = require('fs');
const path = require('path');
const { listEntries, readEntry } = require('../../data_io/zip_reader.cjs');
const png = require('./png.cjs');
const { MULTIMC_ROOT } = require('../../runtime_env/env.cjs').FIXED;

const REPO = path.resolve(__dirname, '..', '..', '..');
const PACK = path.join(REPO, 'resourcepacks', 'evil-eye-cozy-overrides', 'assets');
const NS = 'evileye_glass';
const DEFAULT_JAR = `${MULTIMC_ROOT}/libraries/com/mojang/minecraft/1.21.1/minecraft-1.21.1-client.jar`;
const COLOURS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const KINDS = [{ block: 'glass', pane: 'glass_pane' }]
  .concat(COLOURS.map((c) => ({ block: `${c}_stained_glass`, pane: `${c}_stained_glass_pane` })));

/** Builds the 80x16 pieced sheet: single, centre, left/right frame, top/bottom frame, corner pixels. */
function piecedSheet(v) {
  const px = (x, y) => v.data.subarray((y * 16 + x) * 4, (y * 16 + x) * 4 + 4);
  const counts = new Map();
  for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
    const k = Buffer.from(px(x, y)).toString('hex');
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const base = Buffer.from([...counts.entries()].sort((a, b) => b[1] - a[1])[0][0], 'hex');
  const clamp = (n) => Math.min(14, Math.max(1, n));
  const sheet = { w: 80, h: 16, data: Buffer.alloc(80 * 16 * 4) };
  const put = (tile, x, y, rgba) => Buffer.from(rgba).copy(sheet.data, (y * 80 + tile * 16 + x) * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    put(0, x, y, px(x, y));
    put(1, x, y, base);
    put(2, x, y, x === 0 || x === 15 ? px(x, clamp(y)) : base);
    put(3, x, y, y === 0 || y === 15 ? px(clamp(x), y) : base);
    put(4, x, y, (x === 0 || x === 15) && (y === 0 || y === 15) ? px(x, y) : base);
  }
  return sheet;
}

const paneSides = { north: { model: 'template_glass_pane_side' }, east: { model: 'template_glass_pane_side' },
  south: { model: 'template_glass_pane_side_alt' }, west: { model: 'template_glass_pane_side_alt' } };
const SAME = { type: 'fusion:or', predicates: [{ type: 'fusion:is_same_block' }] };
const textures = (k) => ({ edge: `minecraft:block/${k.pane}_top`, pane: `${NS}:block/${k.block}` });
const conn = (parent, extra) => ({ type: 'fusion:connecting', parent, ...extra, loader: 'fusion:model' });

function paneModels(k) {
  const out = {};
  out[`${k.pane}_post`] = conn('minecraft:block/template_glass_pane_post', { connections: SAME, textures: textures(k) });
  out[`${k.pane}_noside`] = conn('minecraft:block/template_glass_pane_noside', { connections: SAME, textures: textures(k) });
  out[`${k.pane}_noside_alt`] = conn('minecraft:block/template_glass_pane_noside_alt', { connections: SAME, textures: textures(k) });
  for (const [dir, { model }] of Object.entries(paneSides)) {
    out[`${k.pane}_side_${dir}`] = conn(`minecraft:block/${model}`, {
      connections: { type: 'fusion:or', predicates: [
        { type: 'fusion:match_state', block: `minecraft:${k.pane}`, properties: { [dir]: ['true'] } },
        { type: 'fusion:is_direction', directions: ['bottom_left', 'bottom_right', 'left', 'right', 'top_left', 'top_right'] },
      ] },
      textures: textures(k),
    });
  }
  return out;
}

function paneBlockstate(k) {
  const m = (suffix) => `${NS}:block/${k.pane}_${suffix}`;
  return { multipart: [
    { apply: { model: m('post') } },
    { apply: { model: m('side_north') }, when: { north: 'true' } },
    { apply: { model: m('side_east'), y: 90 }, when: { east: 'true' } },
    { apply: { model: m('side_south') }, when: { south: 'true' } },
    { apply: { model: m('side_west'), y: 90 }, when: { west: 'true' } },
    { apply: { model: m('noside') }, when: { north: 'false' } },
    { apply: { model: m('noside_alt') }, when: { east: 'false' } },
    { apply: { model: m('noside_alt'), y: 90 }, when: { south: 'false' } },
    { apply: { model: m('noside'), y: 270 }, when: { west: 'false' } },
  ] };
}

function build(clientJar) {
  const jar = fs.readFileSync(clientJar);
  const entries = new Map(listEntries(jar).map((e) => [e.name, e]));
  const vanilla = (name) => {
    const e = entries.get(`assets/minecraft/textures/block/${name}.png`);
    if (!e) throw new Error(`client jar has no textures/block/${name}.png`);
    return png.decode(readEntry(jar, e));
  };
  const files = new Map();
  const json = (rel, obj) => files.set(rel, Buffer.from(JSON.stringify(obj, null, 2) + '\n'));
  for (const k of KINDS) {
    files.set(`${NS}/textures/block/${k.block}.png`, png.encode(piecedSheet(vanilla(k.block))));
    json(`${NS}/textures/block/${k.block}.png.mcmeta`, { fusion: { type: 'connecting', layout: 'pieced' } });
    json(`${NS}/models/block/${k.block}.json`, conn('minecraft:block/cube_all', { textures: { all: `${NS}:block/${k.block}` } }));
    json(`minecraft/blockstates/${k.block}.json`, { variants: { '': { model: `${NS}:block/${k.block}` } } });
    for (const [name, model] of Object.entries(paneModels(k))) json(`${NS}/models/block/${name}.json`, model);
    json(`minecraft/blockstates/${k.pane}.json`, paneBlockstate(k));
  }
  json(`${NS}/fusion/model_modifiers/blocks/pane_culling_fix.json`,
    { pane_culling_fix: true, targets: KINDS.map((k) => `minecraft:${k.pane}`) });
  return files;
}

function main() {
  const i = process.argv.indexOf('--client-jar');
  const jar = i > 0 ? process.argv[i + 1] : DEFAULT_JAR;
  const files = build(jar);
  const written = [];
  for (const [rel, buf] of files) {
    const dest = path.join(PACK, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    written.push(rel);
  }
  console.log(`wrote ${written.length} files under ${path.relative(REPO, PACK)}`);
}

module.exports = { build, piecedSheet, KINDS, NS };
if (require.main === module) {
  try { main(); console.log('OK exit 0'); } catch (e) { console.error(`FAILED exit 1: ${e.message}`); process.exit(1); }
}
