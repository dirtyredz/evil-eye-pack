'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { resolvePinnedJar } = require('../../packwiz/pinned_jar.cjs');
const { listEntries, readEntry } = require('../../data_io/zip_reader.cjs');
const { parseMods, manifestVersion, METADATA } = require('../../data_io/mod_metadata.cjs');
const { strings } = require('./class_references.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function scanArchive(bytes, archivePath, pin, result, depth = 0) {
  if (depth > 32) throw new Error('Recursion limit reached: ' + archivePath);
  const entries = listEntries(bytes);
  const archive = { path: archivePath, root: pin, sha256: hash(bytes), classCount: 0, metadata: [], references: [] };
  result.archives.push(archive);
  const read = e => readEntry(bytes, e, { maxSize: 512 * 1024 * 1024 });
  const manifest = entries.find(e => e.name === 'META-INF/MANIFEST.MF');
  const version = manifest && manifestVersion(read(manifest).toString('utf8'));
  for (const entry of entries) {
    if (entry.name.toLowerCase().endsWith('.jar')) {
      scanArchive(read(entry), archivePath + '!' + entry.name, pin, result, depth + 1);
    } else if (Object.values(METADATA).includes(entry.name)) {
      const raw = read(entry).toString('utf8');
      archive.metadata.push({ path: entry.name, raw, mods: parseMods(raw, { version }) });
    } else if (entry.name.endsWith('.class')) {
      archive.classCount++;
      const values = strings(read(entry));
      for (const [kind, pattern] of [['ipn', /org[/.]anti_ad[/.]/], ['kotlin', /(?:kotlin[/.]|kotlinforforge|kotlin_for_forge)/]]) {
        const hits = [...new Set(values.filter(v => pattern.test(v)))];
        if (hits.length) archive.references.push({ class: entry.name, kind, values: hits });
      }
    }
  }
}

function audit(root,caches,removed = new Set()) {
const result = { complete:true, pins:[], archives:[], errors:[], consumers:{ipn:[],kotlin:[]},
 method:'All nested jars and class constant-pool strings; conservative references, no local-package suppression.' };
for (const file of fs.readdirSync(path.join(root, 'mods')).filter(f => f.endsWith('.pw.toml')).sort()) {
  try {
    const { bytes, ...pin } = resolvePinnedJar(fs.readFileSync(path.join(root, 'mods', file), 'utf8'), caches, file);
    result.pins.push({ ...pin, metafile: file, excludedFromRetainedScan: removed.has(file) });
    scanArchive(bytes, pin.filename, file, result);
  } catch (error) {
    result.complete = false; result.errors.push({ file, error: error.message });
  }
}
for (const archive of result.archives) {
  if (removed.has(archive.root)) continue;
  for (const kind of ['ipn', 'kotlin']) {
    const references = archive.references.filter(r => r.kind === kind);
    const dependencies = archive.metadata.flatMap(m => m.mods.flatMap(mod => mod.dependencies
      .filter(d => kind === 'ipn' ? /^(inventoryprofilesnext|libipn)$/.test(d.id) : /kotlin/i.test(d.id))
      .map(dependency => ({ mod: mod.id, dependency }))));
    if (references.length || dependencies.length) result.consumers[kind].push({ root: archive.root, archive: archive.path,
      referringClasses: references.length, dependencies });
  }
}
result.totals = { roots: result.pins.length, archives: result.archives.length,
  nested: result.archives.length - result.pins.length,
  classes: result.archives.reduce((sum, a) => sum + a.classCount, 0),
  retainedClasses: result.archives.filter(a => !removed.has(a.root)).reduce((sum, a) => sum + a.classCount, 0),
  metadataFiles: result.archives.reduce((sum, a) => sum + a.metadata.length, 0) };

return result;
}
module.exports = { audit, scanArchive };
