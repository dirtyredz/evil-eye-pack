'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolvePinnedJar } = require('../../packwiz/pinned_jar.cjs');
const { listEntries, readEntry } = require('../../data_io/zip_reader.cjs');
const { parseMods, manifestVersion, METADATA } = require('../../data_io/mod_metadata.cjs');
const { strings } = require('./class_references.cjs');
const { profile, verdict } = require('./targets.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function scanArchive(bytes, archivePath, pin, result, depth = 0, definitions = profile().definitions) {
  if (depth > 32) throw new Error('Recursion limit reached: ' + archivePath);
  const entries = listEntries(bytes);
  const archive = { path: archivePath, root: pin, sha256: hash(bytes), classCount: 0, metadata: [], references: [] };
  result.archives.push(archive);
  const read = e => readEntry(bytes, e, { maxSize: 512 * 1024 * 1024 });
  const manifest = entries.find(e => e.name === 'META-INF/MANIFEST.MF');
  const version = manifest && manifestVersion(read(manifest).toString('utf8'));
  const jarjar = entries.find(e => e.name === 'META-INF/jarjar/metadata.json');
  if (jarjar) {
    const document = JSON.parse(read(jarjar).toString('utf8'));
    if (!Array.isArray(document.jars)) throw new Error('Malformed jar-in-jar metadata: ' + archivePath);
    for (const child of document.jars) if (typeof child.path !== 'string' || !entries.some(e => e.name === child.path))
      throw new Error('Missing declared nested jar: ' + archivePath + '!' + child.path);
  }
  for (const entry of entries) {
    if (entry.name.toLowerCase().endsWith('.jar')) {
      scanArchive(read(entry), archivePath + '!' + entry.name, pin, result, depth + 1, definitions);
    } else if (Object.values(METADATA).includes(entry.name)) {
      const raw = read(entry).toString('utf8');
      const mods = parseMods(raw, { version });
      if (!mods.length) throw new Error('Empty mod metadata: ' + archivePath + '!' + entry.name);
      archive.metadata.push({ path: entry.name, raw, mods });
    } else if (entry.name.endsWith('.class')) {
      archive.classCount++;
      const values = strings(read(entry));
      for (const [kind, { classes: pattern }] of Object.entries(definitions)) {
        const hits = [...new Set(values.filter(v => pattern.test(v)))];
        if (hits.length) archive.references.push({ class: entry.name, kind, values: hits });
      }
    }
  }
}

function audit(root,caches,removed = new Set(), selected = profile()) {
const result = { complete:true, profile:selected.name, removed:[...removed], pins:[], archives:[], errors:[],
 consumers:Object.fromEntries(Object.keys(selected.definitions).map(k => [k, []])), providers:Object.create(null), duplicateProviders:[],
 method:'All nested jars and class constant-pool strings; conservative references, no local-package suppression.' };
for (const file of fs.readdirSync(path.join(root, 'mods')).filter(f => f.endsWith('.pw.toml')).sort()) {
  try {
    const { bytes, ...pin } = resolvePinnedJar(fs.readFileSync(path.join(root, 'mods', file), 'utf8'), caches, file);
    result.pins.push({ ...pin, metafile: file, excludedFromRetainedScan: removed.has(file) });
    scanArchive(bytes, pin.filename, file, result, 0, selected.definitions);
  } catch (error) {
    result.complete = false; result.errors.push({ file, error: error.message });
  }
}
if (!result.pins.length && !result.errors.length) { result.complete = false; result.errors.push({error:'No resolved pins'}); }
for (const archive of result.archives) {
  if (removed.has(archive.root)) continue;
  // NeoForge selects its metadata when a jar also carries the Forge file.
  const metadata = archive.metadata.filter(m => m.path === METADATA.neoforge);
  const effective = metadata.length ? metadata : archive.metadata;
  for (const mod of effective.flatMap(m => m.mods)) {
    (result.providers[mod.id] ??= []).push({root:archive.root, archive:archive.path, version:mod.version});
  }
  for (const [kind, definition] of Object.entries(selected.definitions)) {
    const references = archive.references.filter(r => r.kind === kind);
    const dependencies = effective.flatMap(m => m.mods.flatMap(mod => mod.dependencies
      .filter(d => definition.ids.test(d.id))
      .map(dependency => ({ mod: mod.id, dependency }))));
    if (references.length || dependencies.length) result.consumers[kind].push({ root: archive.root, archive: archive.path,
      referringClasses: references.length, dependencies });
  }
}
result.duplicateProviders = Object.entries(result.providers).filter(([, rows]) => rows.length > 1)
  .map(([id, providers]) => ({ id, providers }));
// Duplicate target providers make a removal claim ambiguous. Unrelated bundled providers
// remain explicit evidence, since FML can select a version of those libraries normally.
for (const row of result.duplicateProviders) if (Object.values(selected.definitions).some(d => d.ids.test(row.id))) {
  result.complete = false; result.errors.push({error:'Duplicate target provider: ' + row.id, providers:row.providers});
}
result.totals = { roots: result.pins.length, archives: result.archives.length,
  nested: result.archives.length - result.pins.length,
  classes: result.archives.reduce((sum, a) => sum + a.classCount, 0),
  retainedClasses: result.archives.filter(a => !removed.has(a.root)).reduce((sum, a) => sum + a.classCount, 0),
  metadataFiles: result.archives.reduce((sum, a) => sum + a.metadata.length, 0) };

result.verdict = verdict(result, selected);
return result;
}
module.exports = { audit, scanArchive };
