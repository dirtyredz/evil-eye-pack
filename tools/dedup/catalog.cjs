'use strict';
// Scan only the pack's pinned jars, never stray jars left in a test instance.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { listEntries, readEntry } = require('../emi_coverage/zip_reader.cjs');
const { readMetafileDownload } = require('../packwiz/pack_index.cjs');
const root = path.resolve(__dirname, '../..');
function scan(dirs) {
  const data = new Map(), models = new Set(), jars = [];
  for (const file of fs.readdirSync(path.join(root, 'mods')).filter(f => f.endsWith('.pw.toml'))) {
    const meta = readMetafileDownload(fs.readFileSync(path.join(root, 'mods', file), 'utf8'));
    const source = dirs.map(dir => path.join(dir, meta.filename)).find(f => fs.existsSync(f));
    if (!source) throw new Error('Missing cached jar: ' + meta.filename);
    const bytes = fs.readFileSync(source);
    if (crypto.createHash(meta.hashFormat).update(bytes).digest('hex') !== meta.hash) throw new Error('Jar hash mismatch: ' + source);
    jars.push(meta.filename);
    for (const entry of listEntries(bytes)) {
      const model = entry.name.match(/^assets\/([^/]+)\/models\/item\/(.+)\.json$/);
      if (model) models.add(model[1] + ':' + model[2]);
      if (!/^data\/[^/]+\/(tags\/(items|blocks)|recipes|loot_tables|loot_modifiers|worldgen|forge\/biome_modifier)\/.+\.json$/.test(entry.name)) continue;
      let json;
      try { json = JSON.parse(readEntry(bytes, entry)); } catch { continue; }
      if (entry.name.includes('/tags/')) {
        const previous = data.get(entry.name);
        if (previous && !json.replace) json.values = [...previous.values, ...json.values];
      }
      data.set(entry.name, json);
    }
  }
  return { data, models, jars };
}
function resolveTags(data, type, excluded = new Set()) {
  const tags = new Map();
  for (const [file, json] of data) {
    const m = file.match(new RegExp('^data/([^/]+)/tags/' + type + '/(.+)\\.json$'));
    if (m) tags.set(m[1] + ':' + m[2], json.values.map(v => typeof v === 'string' ? v : v.id));
  }
  function resolve(id, seen = new Set()) {
    if (seen.has(id)) return [];
    const next = new Set(seen).add(id);
    return [...new Set((tags.get(id) || []).flatMap(v => v.startsWith('#') ? resolve(v.slice(1), next) : excluded.has(v) ? [] : [v]))];
  }
  return new Map([...tags.keys()].map(id => [id, resolve(id)]));
}
function duplicateGroups(tags) {
  const groups = {};
  for (const [tag, values] of tags) {
    if (!/^forge:(?:(?:ingots|nuggets|dusts|plates|gears|rods|raw_materials|storage_blocks|ores|gems)\/|silicon$|wither_bones$)/.test(tag)) continue;
    const namespaces = [...new Set(values.map(v => v.split(':')[0]))].sort();
    if (namespaces.length > 1) groups[tag] = namespaces;
  }
  return groups;
}
module.exports = { root, scan, resolveTags, duplicateGroups };
