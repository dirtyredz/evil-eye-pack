'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { listEntries, readEntry } = require('../data_io/zip_reader.cjs');
const { readMetafileDownload, readMetafileName } = require('../packwiz/pack_index.cjs');
const { parseMods, tables } = require('./toml.cjs');

function inspectJar(bytes, source, visit, depth = 0) {
  if (depth > 8) throw new Error('Nested jar depth exceeded: ' + source);
  const entries = listEntries(bytes);
  const read = name => { const e = entries.find(e => e.name === name); return e && readEntry(bytes, e, { maxSize: 128 * 1024 * 1024 }); };
  const toml = read('META-INF/mods.toml');
  visit({ source, mods: toml ? parseMods(toml.toString('utf8')) : [], bundled: depth > 0 });
  const metadata = read('META-INF/jarjar/metadata.json');
  if (metadata) for (const jar of JSON.parse(metadata.toString('utf8')).jars || []) {
    const nested = read(jar.path);
    if (!nested) throw new Error('Missing declared jar-in-jar: ' + jar.path);
    inspectJar(nested, source + '!' + jar.path, visit, depth + 1);
  }
}
function inventory(root, dirs) {
  const nodes = [], pins = [], warnings = [], bundles = new Map();
  for (const file of fs.readdirSync(path.join(root, 'mods')).filter(f => f.endsWith('.pw.toml')).sort()) {
    const text = fs.readFileSync(path.join(root, 'mods', file), 'utf8');
    const pin = readMetafileDownload(text), name = readMetafileName(text);
    const side = tables(text)[0].values.side || 'both';
    if (!pin.filename || /[\\/]/.test(pin.filename)) throw new Error('Invalid filename in ' + file);
    let bytes, source;
    for (const dir of dirs) {
      const candidate = path.join(dir, pin.filename);
      if (!fs.existsSync(candidate)) continue;
      const b = fs.readFileSync(candidate);
      if (crypto.createHash(pin.hashFormat).update(b).digest('hex') === pin.hash) { bytes = b; source = candidate; break; }
    }
    if (!bytes) throw new Error('Missing pinned jar (no download attempted): ' + pin.filename);
    const node = { key: pin.filename, name, side, source, mods: [], bundled: [], dependencies: [] };
    inspectJar(bytes, pin.filename, entry => {
      if (entry.bundled) node.bundled.push(entry.source);
      if (entry.bundled && entry.mods.length) {
        const key = 'bundled:' + entry.mods.map(m => m.id).sort().join('+');
        if (!bundles.has(key)) bundles.set(key, { key, name: entry.mods.map(m => m.name).join(' + '), side,
          source: entry.source, mods: entry.mods, bundled: [], dependencies: [], embedded: true, providers: [] });
        const bundle = bundles.get(key);
        bundle.providers.push(pin.filename);
        if (side !== 'client') bundle.side = side;
        node.dependencies.push(key);
      } else node.mods.push(...entry.mods);
    });
    if (!node.mods.length) warnings.push(name + ': no Forge mods.toml; jar retained as a standalone unit');
    nodes.push(node); pins.push({ filename: pin.filename, hash: pin.hash, hashFormat: pin.hashFormat });
  }
  // A mod offered both externally and inside another jar is one loaded mod ID,
  // not two timings. Prefer the external removal unit, retaining provenance.
  for (const [key, bundle] of bundles) {
    const external = nodes.find(n => bundle.mods.every(m => n.mods.some(x => x.id === m.id)));
    if (!external) continue;
    external.providers = bundle.providers;
    warnings.push(bundle.name + ': external and embedded providers; represented once under ' + external.key + '; Forge selects the runtime version');
    for (const n of nodes) n.dependencies = n.dependencies.map(d => d === key ? external.key : d);
    bundles.delete(key);
  }
  // Some language-loader distributions are wrapper jars whose only Forge
  // metadata lives in their sole nested archive. Keep the physical jar as the
  // removal unit so dependants nest the installed jar, not an orphan wrapper.
  for (const [key, bundle] of bundles) {
    if (bundle.providers.length !== 1) continue;
    const host = nodes.find(n => n.key === bundle.providers[0]);
    if (!host || host.mods.length || !host.dependencies.includes(key)) continue;
    host.mods.push(...bundle.mods);
    host.dependencies = [...new Set([...host.dependencies.filter(d => d !== key), ...bundle.dependencies])];
    warnings.push(host.name + ': Forge metadata is embedded; represented by the physical wrapper jar');
    bundles.delete(key);
  }
  return { nodes: [...nodes, ...bundles.values()], pins, warnings };
}
module.exports = { inspectJar, inventory };
