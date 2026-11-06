'use strict';
// Curios 9.5.1 gives a slot type a cosmetic slot only when its slot data sets add_cosmetic: true.
// kubejs/data/curios/curios/slots/<id>.json merges into each slot (replace defaults to false).
// Real pinned-jar guard: every slot id any pinned jar (or jar-in-jar library) defines has such a file, and no
// file is left for a slot nothing defines. Missing cached jars are an error, not a skip (as in the dedup gate).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pinnedJars, defaultJarDirs, root } = require('../../../../analysis/dedup/catalog.cjs');
const { walkJar } = require('../../../../data_io/walk.cjs');

const DIR = path.join(root, 'kubejs', 'data', 'curios', 'curios', 'slots');
const SLOT = /^data\/[^/]+\/curios\/slots\/([^/]+)\.json$/;

test('every curio slot type a pinned jar defines enables a cosmetic slot, without clobbering other slot data', () => {
  const defined = new Map(); // id -> first source jar
  for (const jar of pinnedJars(defaultJarDirs())) {
    walkJar(jar.bytes, jar.filename, (name, _text, source) => {
      const id = SLOT.exec(name)[1];
      if (!defined.has(id)) defined.set(id, source);
    }, { matches: (n) => SLOT.test(n), nested: true });
  }
  assert.ok(defined.size > 0, 'no curio slot data found in the pinned jars; is the jar cache the right one?');
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const ids = [...defined.keys()];
  assert.deepEqual(ids.filter((i) => !files.includes(i)).map((i) => `${i} (${defined.get(i)})`), [],
    'add kubejs/data/curios/curios/slots/<id>.json with {"add_cosmetic": true} for each new slot type');
  assert.deepEqual(files.filter((f) => !defined.has(f)), [], 'cosmetic files for slot types no pinned jar defines');
  for (const id of files) {
    const raw = fs.readFileSync(path.join(DIR, `${id}.json`), 'utf8');
    assert.ok(!raw.includes('\r'), `${id}.json must be LF`);
    assert.deepEqual(JSON.parse(raw), { add_cosmetic: true }, `${id}.json must only set add_cosmetic`);
  }
});
