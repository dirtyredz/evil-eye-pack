'use strict';
// Guard: Ice and Fire biome filter files must only name tags that exist on NeoForge 1.21.1.
// Legacy `forge:` tags match nothing there, silently. Tag set: ../../data/biome_tags.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../../..');
const dir = path.join(root, 'config', 'iceandfire');
const known = new Set(require('../../data/biome_tags.json').tags);

function tagRefs(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => tagRefs(n, out));
  else if (node && typeof node === 'object') {
    if (node.type === 'BIOME_TAG') out.push(node.value);
    Object.values(node).forEach((n) => tagRefs(n, out));
  }
  return out;
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('_biomes.json'));

test('there are Ice and Fire biome files to check', () => assert.ok(files.length >= 40));

test('no legacy forge: biome tags', () => {
  const bad = files.filter((f) => /"forge:/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.deepEqual(bad, []);
});

test('every BIOME_TAG exists in NeoForge/vanilla', () => {
  const missing = [];
  for (const f of files) {
    for (const t of tagRefs(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))) {
      if (!known.has(t)) missing.push(`${f}: ${t}`);
    }
  }
  assert.deepEqual(missing, []);
});
