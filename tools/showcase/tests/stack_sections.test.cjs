'use strict';
// Production layout of the Phase 7 sections (Mekanism, Interstellaris + Sable), checked without a server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pinnedJars, defaultJarDirs } = require('../../dedup/catalog.cjs');
const { listEntries } = require('../../data_io/zip_reader.cjs');

const scripts = path.resolve(__dirname, '../../../kubejs/server_scripts/showcase');
function load() {
  const context = vm.createContext({ global: {} });
  for (const file of ['plan.js', 'rigs/create_contraption.js', 'sections/mekanism_machines.js', 'sections/interstellaris_space.js']) vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context);
  return context.global.evilEyeShowcase;
}
const at = (p, x, y, z) => p.blocks.find((b) => b.x === x && b.y === y && b.z === z);

test('Mekanism: the creative cube faces its cable line, and every machine backs onto that line', () => {
  const ns = load(), p = ns.validate(ns.sections.mekanism_machines());
  const cube = at(p, 1, 0, 5);
  assert.equal(cube.state, 'mekanism:creative_energy_cube[facing=east]', 'the cube outputs from its front');
  assert.match(cube.nbt, /energy_containers:\[\{container:0b,stored:9223372036854775807L\}\]/, 'a command-placed creative cube starts empty unless filled');
  for (let x = 2; x <= 9; x++) assert.equal(at(p, x, 0, 5).state, 'mekanism:basic_universal_cable');
  for (const [x, id, input] of [[3, 'mekanism:enrichment_chamber', 'minecraft:iron_ore'], [7, 'mekanism:crusher', 'minecraft:iron_ingot']]) {
    assert.ok(at(p, x, 0, 4).state.startsWith(id + '[facing=north'), `${id} faces the entrance`);
    assert.ok(at(p, x, 0, 5).state.endsWith('universal_cable'), `${id} backs onto the cable`);
    assert.equal(at(p, x, 0, 4).nbt, `{items:[{slot:0,item:{id:"${input}",count:16}}],energy_containers:[{container:0b,stored:20000L}]}`, `${id} input and charge prefilled through its own records`);
  }
  assert.equal(at(p, 12, 0, 4).nbt, '{items:[{slot:0,item:{id:"minecraft:coal",count:32}}]}', 'the heat generator has fuel');
  assert.equal(p.fills.length, 0, 'Mekanism machines refuse automated prefill at placement');
});

test('Interstellaris: ore under each metal block, and a free-floating Sable pad with air beneath', () => {
  const ns = load(), p = ns.validate(ns.sections.interstellaris_space());
  for (const [i, metal] of ['titanium', 'platinum', 'silver', 'tungsten'].entries()) {
    assert.equal(at(p, 1 + i * 2, 0, 4).state, `interstellaris:${metal}_ore`);
    assert.equal(at(p, 1 + i * 2, 1, 4).state, `interstellaris:${metal}_block`);
  }
  const pad = p.blocks.filter((b) => b.state === 'minecraft:iron_block');
  assert.equal(pad.length, 9);
  for (const b of pad) {
    assert.equal(b.y, 4);
    for (let y = 0; y < 4; y++) assert.equal(at(p, b.x, y, b.z), undefined, 'nothing under the pad, so the assembled sub-level can fall');
  }
});

test('every block the Phase 7 sections place is registered by a pinned jar (blockstate present)', () => {
  const ns = load(), wanted = new Set();
  for (const name of ['mekanism_machines', 'interstellaris_space']) for (const b of ns.sections[name]().blocks) wanted.add(b.state.split('[')[0]);
  const states = new Set();
  for (const jar of pinnedJars(defaultJarDirs())) {
    if (!/^(Mekanism|Interstellaris)/.test(jar.filename)) continue;
    for (const e of listEntries(jar.bytes)) { const m = /^assets\/([^/]+)\/blockstates\/(.+)\.json$/.exec(e.name); if (m) states.add(`${m[1]}:${m[2]}`); }
  }
  const missing = [...wanted].filter((id) => !id.startsWith('minecraft:') && !states.has(id));
  assert.deepEqual(missing, []);
});
