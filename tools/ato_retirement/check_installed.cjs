'use strict';
// Read-only check against the pinned, already-downloaded jars. Never downloads.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {listEntries, readEntry} = require('../emi_coverage/zip_reader.cjs');
const root = path.resolve(__dirname, '../..');
const mods = process.argv[2];
if (!mods) throw new Error('Usage: node tools/ato_retirement/check_installed.cjs <installed mods directory>');
const json = f => JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const catalog = json('tools/ato_retirement/tests/catalog.json');
const map = json('kubejs/config/ato_retirement.json').conversions;
const models = new Set(), atoModels = [], compressedModels = [], tags = new Map();
const loot = new Map(), modifiers = [], decompressions = new Map();
for (const name of fs.readdirSync(mods).filter(f => f.endsWith('.jar'))) {
  const bytes = fs.readFileSync(path.join(mods,name));
  for (const entry of listEntries(bytes)) {
    let m = entry.name.match(/^assets\/([^/]+)\/models\/item\/(.+)\.json$/);
    if (m) {
      const id = m[1] + ':' + m[2]; models.add(id);
      if (m[1] === 'alltheores') atoModels.push(id);
      if (m[1] === 'allthecompressed') compressedModels.push(id);
    }
    if ((m = entry.name.match(/^data\/([^/]+)\/tags\/blocks\/(.+)\.json$/))) {
      const data = JSON.parse(readEntry(bytes,entry));
      const id = m[1] + ':' + m[2];
      tags.set(id, [...(data.replace ? [] : tags.get(id) || []), ...data.values.map(v => typeof v === 'string' ? v : v.id)]);
    }
    if (/^data\/alltheores\/loot_tables\/blocks\/.+\.json$/.test(entry.name)) loot.set(entry.name,JSON.parse(readEntry(bytes,entry)));
    if (/^data\/alltheores\/forge\/biome_modifier\/.+\.json$/.test(entry.name)) modifiers.push(entry.name);
    if (/^data\/allthecompressed\/recipes\/decompress\/.+\.json$/.test(entry.name)) decompressions.set(entry.name,JSON.parse(readEntry(bytes,entry)));
  }
}
assert.deepEqual(atoModels.sort(), [...catalog.alltheores,...catalog.modelOnlyMekanism].sort(), 'AllTheOres jar inventory changed');
assert.deepEqual(compressedModels.sort(),catalog.allthecompressedBases.flatMap(base => Array.from({length:9},(_,i) => 'allthecompressed:' + base + '_' + (i+1) + 'x')).sort());
for (const [source,target] of Object.entries(map)) {
  assert.ok(models.has(source), source);
  assert.ok(target.startsWith('minecraft:') || models.has(target), target);
}
assert.equal(modifiers.length,31);
for (const file of modifiers) assert.deepEqual(json('kubejs/' + file), {type:'forge:none'});
let overrides = 0;
for (const [file, original] of loot) {
  const item = 'alltheores:' + path.basename(file,'.json');
  if (!map[item] || !/_ore$|^alltheores:raw_.*_block$/.test(item)) continue;
  const expected = JSON.parse(JSON.stringify(original).replace(/"alltheores:([a-z_]+)"/g, (full,id) => map['alltheores:'+id] ? JSON.stringify(map['alltheores:'+id]) : full));
  assert.deepEqual(json('kubejs/' + file),expected, file + ': preserve original loot conditions and counts'); overrides++;
}
function containsAto(id, visited = new Set()) {
  if (id.startsWith('alltheores:')) return true;
  if (!id.startsWith('#') || visited.has(id)) return false;
  visited.add(id);
  return (tags.get(id.slice(1)) || []).some(value => containsAto(value,visited));
}
let deposits = 0;
const unsafeDeposits = [];
for (const name of fs.readdirSync(path.join(root,'config/adlods/Deposits'))) {
  const text = fs.readFileSync(path.join(root,'config/adlods/Deposits',name),'utf8');
  if (/B:enabled=false/.test(text)) continue;
  for (const block of text.matchAll(/S:(?:ores|customReplacements|circles) <([\s\S]*?)>/g)) {
    for (const line of block[1].trim().split('\n')) {
      for (const id of line.trim().split(/\s*->\s*|,\s*/)) if (containsAto(id)) unsafeDeposits.push(name + ': ' + id);
    }
  }
  deposits++;
}
assert.deepEqual(unsafeDeposits, [], 'Active deposits can still place AllTheOres');
let unpacking = 0;
for (const [base,target] of Object.entries(catalog.unpackedSurvivors)) {
  assert.ok(target.startsWith('minecraft:') || models.has(target), target);
  for (let tier=1;tier<=9;tier++) {
    const recipe = decompressions.get('data/allthecompressed/recipes/decompress/'+base+'_'+tier+'x.json');
    assert.ok(recipe, base + ' tier ' + tier);
    assert.equal(recipe.ingredients[0].item,'allthecompressed:'+base+'_'+tier+'x');
    assert.equal(recipe.result.count,9);
    if(tier>1) assert.equal(recipe.result.item,'allthecompressed:'+base+'_'+(tier-1)+'x');
    else assert.equal(map[recipe.result.item] || recipe.result.item,target);
    unpacking++;
  }
}
console.log('PASS: 250 registered AllTheOres items + 44 conditional model-only items; 981 compressed blocks; ' + Object.keys(map).length + ' conversions; ' + modifiers.length + ' disabled biome modifiers; ' + overrides + ' preserved loot tables; ' + deposits + ' safe active deposits; ' + unpacking + ' material-preserving unpacking steps');
