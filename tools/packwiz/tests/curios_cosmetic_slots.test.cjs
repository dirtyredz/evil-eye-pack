'use strict';
// Curios 9.5.1 gives a slot type a cosmetic slot only when its slot data sets add_cosmetic: true.
// kubejs/data/curios/curios/slots/<id>.json merges into each slot (replace defaults to false).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', '..', '..', 'kubejs', 'data', 'curios', 'curios', 'slots');
// Curios defaults + Ars Nouveau/Elemental (an_focus, bundle), Baubley (heart_amulet), L_Ender's Cataclysm (feet, rings, talisman, waist).
const EXPECTED = ['an_focus', 'back', 'belt', 'body', 'bracelet', 'bundle', 'charm', 'curio', 'feet',
  'hands', 'head', 'heart_amulet', 'necklace', 'talisman', 'waist', 'ring', 'rings'].sort();

test('every pack curio slot type enables a cosmetic slot without clobbering other slot data', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
  assert.deepStrictEqual(files, EXPECTED);
  for (const id of files) {
    const raw = fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8');
    assert.ok(!raw.includes('\r'), `${id}.json must be LF`);
    assert.deepStrictEqual(JSON.parse(raw), { add_cosmetic: true }, `${id}.json must only set add_cosmetic`);
  }
});
