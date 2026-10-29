'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { readMetafileName, readMetafileSide } = require('../../packwiz/pack_index.cjs');
const { resolvePinnedJar } = require('../../packwiz/pinned_jar.cjs');
const { readJarMods } = require('../../data_io/mod_metadata.cjs');

// Each declared unit (outer jar, then its jar-in-jar entries) through the shared metadata reader.
function inspectJar(bytes, source, visit) {
  for (const unit of readJarMods(bytes, source)) visit({ source: unit.source, mods: unit.mods, bundled: unit.bundled });
}
function inventory(root, dirs) {
  const nodes = [], pins = [], warnings = [], bundles = new Map();
  for (const file of fs.readdirSync(path.join(root, 'mods')).filter(f => f.endsWith('.pw.toml')).sort()) {
    const text = fs.readFileSync(path.join(root, 'mods', file), 'utf8');
    const name = readMetafileName(text), side = readMetafileSide(text);
    const { bytes, path: source, ...pin } = resolvePinnedJar(text, dirs, 'mods/' + file);
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
    if (!node.mods.length) warnings.push(name + ': no Forge/NeoForge mods.toml; jar retained as a standalone unit');
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
