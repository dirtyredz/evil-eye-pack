'use strict';
// Scan only the pack's pinned jars, never stray jars left in a test instance.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../data_io/files.cjs');
const crypto = require('node:crypto');
const { walkJar } = require('../data_io/walk.cjs');
const { readMetafileDownload } = require('../packwiz/pack_index.cjs');
const root = path.resolve(__dirname, '../..');
function scan(dirs) {
  const data = new Map(), models = new Set(), blocks = new Set(), jars = [];
  for (const file of fs.readdirSync(path.join(root, 'mods')).filter(f => f.endsWith('.pw.toml'))) {
    const meta = readMetafileDownload(fs.readFileSync(path.join(root, 'mods', file), 'utf8'));
    const source = dirs.map(dir => path.join(dir, meta.filename)).find(f => fs.existsSync(f));
    if (!source) throw new Error('Missing cached jar: ' + meta.filename);
    const bytes = fs.readFileSync(source);
    if ((meta.hashFormat === 'sha256' ? sha256(bytes) : crypto.createHash(meta.hashFormat).update(bytes).digest('hex')) !== meta.hash) throw new Error('Jar hash mismatch: ' + source);
    jars.push(meta.filename);
    walkJar(bytes, meta.filename, (name, text) => {
      let json;
      try { json = JSON.parse(text); } catch { return; }
      if (name.includes('/tags/')) {
        const previous = data.get(name);
        if (previous && !json.replace) json.values = [...previous.values, ...json.values];
      }
      // Block loot-table paths identify blocks independently of item naming conventions.
      const block = name.match(/^data\/([^/]+)\/loot_tables\/blocks\/(.+)\.json$/);
      if (block) blocks.add(block[1] + ':' + block[2]);
      data.set(name, json);
    }, {
      matches: name => /^data\/[^/]+\/(tags\/(items|blocks)|recipes|loot_tables|loot_modifiers|worldgen|forge\/biome_modifier)\/.+\.json$/.test(name),
      inspect: name => {
        const model = name.match(/^assets\/([^/]+)\/models\/item\/(.+)\.json$/);
        if (model) models.add(model[1] + ':' + model[2]);
      }
    });
  }
  return { data, models, blocks, jars };
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
