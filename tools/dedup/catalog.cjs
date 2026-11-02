'use strict';
// Scan only the pack's pinned jars, never stray jars left in a test instance. Both data layouts are read
// (1.20 plural / 1.21 singular folders, forge/ or neoforge/ biome modifiers); file keys keep each jar's
// own path, so generated overrides land in the layout the jar uses.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../data_io/files.cjs');
const crypto = require('node:crypto');
const { walkJar } = require('../data_io/walk.cjs');
const { classify, matcher } = require('../data_io/resource_layout.cjs');
const { readMetafileDownload } = require('../packwiz/pack_index.cjs');
const root = path.resolve(__dirname, '../..');
const SCANNED = new Set(['tags/items', 'tags/blocks', 'recipes', 'loot_tables', 'loot_modifiers', 'worldgen', 'biome_modifier']);
// Every pinned mod jar's bytes from the cache folders, checked against its metafile hash: [{ filename, bytes }].
function pinnedJars(dirs, packRoot = root) {
  const out = [];
  for (const file of fs.readdirSync(path.join(packRoot, 'mods')).filter(f => f.endsWith('.pw.toml'))) {
    const meta = readMetafileDownload(fs.readFileSync(path.join(packRoot, 'mods', file), 'utf8'));
    const source = dirs.map(dir => path.join(dir, meta.filename)).find(f => fs.existsSync(f));
    if (!source) throw new Error('Missing cached jar: ' + meta.filename);
    const bytes = fs.readFileSync(source);
    if ((meta.hashFormat === 'sha256' ? sha256(bytes) : crypto.createHash(meta.hashFormat).update(bytes).digest('hex')) !== meta.hash) throw new Error('Jar hash mismatch: ' + source);
    out.push({ filename: meta.filename, bytes });
  }
  return out;
}
function scan(dirs, packRoot = root) {
  const data = new Map(), models = new Set(), blocks = new Set(), jars = [];
  for (const { filename, bytes } of pinnedJars(dirs, packRoot)) {
    jars.push(filename);
    walkJar(bytes, filename, (name, text) => {
      let json;
      try { json = JSON.parse(text); } catch { return; }
      const at = classify(name);
      if (at.kind.startsWith('tags/')) {
        const previous = data.get(name);
        if (previous && !json.replace) json.values = [...previous.values, ...json.values];
      }
      // Block loot-table paths identify blocks independently of item naming conventions.
      if (at.kind === 'loot_tables' && at.path.startsWith('blocks/')) blocks.add(at.ns + ':' + at.path.slice('blocks/'.length));
      data.set(name, json);
    }, {
      matches: matcher(SCANNED),
      inspect: name => {
        const model = name.match(/^assets\/([^/]+)\/models\/item\/(.+)\.json$/);
        if (model) models.add(model[1] + ':' + model[2]);
      }
    });
  }
  return { data, models, blocks, jars };
}
// type: 'items' | 'blocks' (the canonical tag kinds of either layout).
function resolveTags(data, type, excluded = new Set()) {
  const tags = new Map();
  for (const [file, json] of data) {
    const at = classify(file);
    if (at && at.kind === 'tags/' + type) tags.set(at.id, json.values.map(v => typeof v === 'string' ? v : v.id));
  }
  function resolve(id, seen = new Set()) {
    if (seen.has(id)) return [];
    const next = new Set(seen).add(id);
    return [...new Set((tags.get(id) || []).flatMap(v => v.startsWith('#') ? resolve(v.slice(1), next) : excluded.has(v) ? [] : [v]))];
  }
  return new Map([...tags.keys()].map(id => [id, resolve(id)]));
}
// Forge 1.20 `forge:` and NeoForge 1.21 common `c:` material tags.
const MATERIAL_TAG = /^(?:forge|c):(?:(?:ingots|nuggets|dusts|plates|gears|rods|raw_materials|storage_blocks|ores|gems)\/|silicon$|wither_bones$|bones\/wither$)/;
// Default pinned-jar folders: DEDUP_MODS, else the instance/cache that holds this runtime's jars.
function defaultJarDirs(packRoot = root) {
  if (process.env.DEDUP_MODS) return process.env.DEDUP_MODS.split(';');
  const env = require('../server_smoke/runtime/env.cjs');
  const { readRuntime } = require('../server_smoke/runtime/runtime.cjs');
  return readRuntime(path.join(packRoot, 'pack.toml')).loader === 'neoforge' ? [env.MIGRATION_MODS] : [env.LOCAL_MODS];
}
function duplicateGroups(tags) {
  const groups = {};
  for (const [tag, values] of tags) {
    if (!MATERIAL_TAG.test(tag)) continue;
    const namespaces = [...new Set(values.map(v => v.split(':')[0]))].sort();
    if (namespaces.length > 1) groups[tag] = namespaces;
  }
  return groups;
}
module.exports = { root, pinnedJars, scan, resolveTags, duplicateGroups, defaultJarDirs, MATERIAL_TAG };
