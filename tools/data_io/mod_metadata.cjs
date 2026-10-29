'use strict';
// Forge `META-INF/mods.toml` and NeoForge `META-INF/neoforge.mods.toml` reader, the one mod
// metadata parser shared by the mod map and the migration tooling. packwiz metafiles (.pw.toml)
// are read through packwiz/pack_index.cjs readTable instead. Reads scalar fields per table;
// unrelated arrays/inline tables are ignored, while quoted strings, comments and multiline
// descriptions are tokenized.
const { listEntries, readEntry } = require('./zip_reader.cjs');

const METADATA = Object.freeze({ neoforge: 'META-INF/neoforge.mods.toml', forge: 'META-INF/mods.toml' });
// NeoForge 1.21 replaced Forge's boolean `mandatory` with a dependency `type`.
const DEPENDENCY_TYPES = new Set(['required', 'optional', 'incompatible', 'discouraged']);

function tables(text) {
  const rows = [{ table: '', values: {} }];
  let row = rows[0];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const header = /^\s*\[\[?([^\]]+)\]\]?\s*(?:#.*)?$/.exec(lines[i]);
    if (header) {
      row = { table: header[1].trim().replace(/["']/g, ''), values: {} }; rows.push(row); continue;
    }
    const kv = /^\s*([\w-]+)\s*=\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let raw = kv[2], value;
    const triple = raw.startsWith('"""') ? '"""' : raw.startsWith("'''") ? "'''" : null;
    if (triple) {
      raw = raw.slice(3);
      while (!raw.includes(triple) && i + 1 < lines.length) raw += '\n' + lines[++i];
      if (!raw.includes(triple)) throw new Error('Unterminated TOML multiline string');
      value = raw.slice(0, raw.indexOf(triple)).replace(/^\n/, '');
      if (triple === '"""') value = decode(value);
    } else if (raw[0] === '"' || raw[0] === "'") {
      const q = raw[0]; let end = 1;
      for (; end < raw.length; end++) {
        if (q === '"' && raw[end] === '\\') { end++; continue; }
        if (raw[end] === q) break;
      }
      if (end === raw.length) throw new Error('Unterminated TOML string');
      value = q === '"' ? decode(raw.slice(1, end)) : raw.slice(1, end);
    } else if (/^(true|false)\s*(?:#.*)?$/.test(raw)) value = raw.startsWith('true');
    else continue;
    row.values[kv[1]] = value;
  }
  return rows;
}
function decode(s) {
  return s.replace(/\\\r?\n\s*/g, '').replace(/\\(u[\da-fA-F]{4}|U[\da-fA-F]{8}|[btnfr"\\])/g, (_, c) =>
    c[0] === 'u' || c[0] === 'U' ? String.fromCodePoint(parseInt(c.slice(1), 16)) : ({ b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' })[c]);
}

// One dependency row. `type` is NeoForge's; Forge rows map mandatory=true to required.
function dependency(values) {
  let type;
  if (values.type !== undefined) {
    type = String(values.type).toLowerCase();
    if (!DEPENDENCY_TYPES.has(type)) throw new Error(`Unsupported dependency type "${values.type}" for ${values.modId}`);
  } else type = values.mandatory === true ? 'required' : 'optional';
  return { id: values.modId, type, mandatory: type === 'required', side: values.side || 'BOTH', range: values.versionRange || '' };
}

// options.version: the jar's Implementation-Version, substituted for `${file.jarVersion}`.
function parseMods(text, { version } = {}) {
  const rows = tables(text);
  const loader = rows[0].values.modLoader;
  return rows.filter(r => r.table === 'mods').map(r => {
    if (!r.values.modId) throw new Error('mods.toml entry without modId');
    const dependencies = rows.filter(d => d.table === 'dependencies.' + r.values.modId).map(d => dependency(d.values));
    // A custom language loader is a runtime dependency even though the file expresses it at the
    // document root instead of in [[dependencies.*]].
    if (loader && !['javafml', 'lowcodefml'].includes(loader) && !dependencies.some(d => d.id === loader)) {
      dependencies.push({ id: loader, type: 'required', mandatory: true, side: 'BOTH', range: '', source: 'modLoader' });
    }
    const raw = r.values.version === undefined ? null : String(r.values.version);
    const modVersion = raw === '${file.jarVersion}' ? (version || null) : raw;
    return { id: r.values.modId, name: r.values.displayName || r.values.modId, version: modVersion,
      description: String(r.values.description || '').replace(/\s+/g, ' ').trim().slice(0, 240),
      dependencies };
  });
}

function manifestVersion(text) {
  const m = /^Implementation-Version:\s*(.+?)\s*$/m.exec(text.replace(/\r?\n /g, ''));
  return m ? m[1] : null;
}

// Every mod a jar declares, its own and its declared jar-in-jar ones. Returns
// [{ source, loader: 'neoforge'|'forge'|null, mods, bundled }] depth-first, the outer jar first.
// A jar carrying both metadata files is read as NeoForge (the file NeoForge loads).
function readJarMods(bytes, source = 'jar', depth = 0) {
  if (depth > 8) throw new Error('Nested jar depth exceeded: ' + source);
  const entries = listEntries(bytes);
  const read = name => { const e = entries.find(x => x.name === name); return e && readEntry(bytes, e, { maxSize: 128 * 1024 * 1024 }); };
  const manifest = read('META-INF/MANIFEST.MF');
  const version = manifest ? manifestVersion(manifest.toString('utf8')) : null;
  const neo = read(METADATA.neoforge);
  const forge = neo ? null : read(METADATA.forge);
  const toml = neo || forge;
  const out = [{ source, loader: neo ? 'neoforge' : forge ? 'forge' : null, version,
    mods: toml ? parseMods(toml.toString('utf8'), { version }) : [], bundled: depth > 0 }];
  const metadata = read('META-INF/jarjar/metadata.json');
  if (metadata) for (const jar of JSON.parse(metadata.toString('utf8')).jars || []) {
    const nested = read(jar.path);
    if (!nested) throw new Error('Missing declared jar-in-jar: ' + jar.path);
    out.push(...readJarMods(nested, source + '!' + jar.path, depth + 1));
  }
  return out;
}

module.exports = { parseMods, readJarMods, manifestVersion, METADATA, DEPENDENCY_TYPES };
