'use strict';
// Raw server data resources, read from the installed throwaway server before it boots: vanilla's data jar,
// every mod jar (and its jar-in-jar libraries) and the KubeJS data folder. Extracts only what the checks need
// (recipe conditions, loot references, tag files, worldgen blocks, removed-namespace mentions) into one
// evidence file, so a run can be re-analysed later without the jars.
//
// Precedence is approximated: KubeJS data > mod jars (alphabetical) > vanilla. For tags every source is
// merged (respecting `replace`); for recipes and loot tables the highest source wins.
const fs = require('node:fs');
const path = require('node:path');
const { listEntries, readEntry } = require('../emi_coverage/zip_reader.cjs');
const { declaredOutputs } = require('./checks/recipes.cjs');

const DATA_RE = /^data\/([^/]+)\/(recipes|loot_tables|tags\/(?:items|blocks|fluids)|worldgen|forge\/biome_modifier)\/(.+)\.json$/;

// Calls visit(relativeDataPath, text, sourceName) for every data JSON in a jar buffer and its nested jars.
function walkJar(buf, source, visit) {
  for (const entry of listEntries(buf)) {
    if (/^META-INF\/jarjar\/.+\.jar$/.test(entry.name)) {
      walkJar(readEntry(buf, entry), `${source}!${path.basename(entry.name)}`, visit);
      continue;
    }
    if (DATA_RE.test(entry.name)) visit(entry.name, readEntry(buf, entry).toString('utf8'), source);
  }
}

function walkDir(dir, rel, source, visit) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) walkDir(p, r, source, visit);
    else if (DATA_RE.test(r)) visit(r, fs.readFileSync(p, 'utf8'), source);
  }
}

// The data sources of an installed server, lowest precedence first: vanilla, Forge, mods, KubeJS.
function serverSources(serverDir) {
  const out = [];
  const vanilla = path.join(serverDir, 'libraries/net/minecraft/server');
  if (fs.existsSync(vanilla)) {
    for (const v of fs.readdirSync(vanilla)) {
      for (const f of fs.readdirSync(path.join(vanilla, v))) if (/-extra\.jar$/.test(f)) out.push({ kind: 'jar', name: 'minecraft', file: path.join(vanilla, v, f) });
    }
  }
  const forge = path.join(serverDir, 'libraries/net/minecraftforge/forge');
  if (fs.existsSync(forge)) {
    for (const v of fs.readdirSync(forge)) {
      for (const f of fs.readdirSync(path.join(forge, v))) if (/-universal\.jar$/.test(f)) out.push({ kind: 'jar', name: 'forge', file: path.join(forge, v, f) });
    }
  }
  const mods = path.join(serverDir, 'mods');
  if (fs.existsSync(mods)) for (const f of fs.readdirSync(mods).filter((x) => x.endsWith('.jar')).sort()) out.push({ kind: 'jar', name: f, file: path.join(mods, f) });
  out.push({ kind: 'dir', name: 'kubejs', file: path.join(serverDir, 'kubejs/data') });
  return out;
}

// Pulls the references a loot table makes: item and tag entries, nested tables, block predicates.
const COMPOSITE = new Set(['alternatives', 'group', 'sequence']);
function lootRefs(json) {
  const refs = { items: new Set(), tags: new Set(), tables: new Set(), blocks: new Set(), opaque: new Set() };
  const conditions = (v) => {
    if (Array.isArray(v)) { v.forEach(conditions); return; }
    if (!v || typeof v !== 'object') return;
    const cond = typeof v.condition === 'string' ? v.condition.replace(/^minecraft:/, '') : null;
    if (cond === 'block_state_property' && typeof v.block === 'string') refs.blocks.add(v.block);
    Object.values(v).forEach(conditions);
  };
  const entry = (e) => {
    if (!e || typeof e !== 'object') return;
    const type = typeof e.type === 'string' ? e.type.replace(/^minecraft:/, '') : '';
    if (type === 'item' && typeof e.name === 'string') refs.items.add(e.name);
    else if (type === 'tag' && typeof e.name === 'string') refs.tags.add(e.name);
    else if (type === 'loot_table' && typeof e.name === 'string') refs.tables.add(e.name);
    else if (COMPOSITE.has(type)) (e.children || []).forEach(entry);
    else if (type !== 'empty') refs.opaque.add(e.type || '(no type)');
    conditions(e.conditions);
  };
  for (const pool of json.pools || []) {
    (pool.entries || []).forEach(entry);
    conditions(pool.conditions);
  }
  return { items: [...refs.items], tags: [...refs.tags], tables: [...refs.tables], blocks: [...refs.blocks], opaque: [...refs.opaque] };
}

// Block ids named anywhere in a worldgen file: block states (`Name`) and plain `block`/`state` strings.
function worldgenBlocks(json, out) {
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, child] of Object.entries(v)) {
      if ((k === 'Name' || k === 'block') && typeof child === 'string' && child.includes(':')) out.add(child);
      else walk(child);
    }
  };
  walk(json);
}

// Every namespaced id mentioned in a JSON document whose namespace is in `namespaces`.
function namespaceMentions(text, namespaces) {
  if (!namespaces.length) return [];
  const re = new RegExp(`["#](${namespaces.map((n) => n.replace(/[^a-z0-9_]/g, '')).join('|')}):[a-z0-9_/.-]+`, 'g');
  return [...new Set((text.match(re) || []).map((m) => m.slice(1)))];
}

// Minecraft reads data JSON through lenient Gson: a BOM, comments and trailing commas are accepted.
// Returns { json, lenient } or throws when even the lenient form is not JSON.
function parseLenient(text) {
  const t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try { return { json: JSON.parse(t), lenient: t !== text }; } catch { /* retry leniently */ }
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"') {
      let j = i + 1;
      while (j < t.length && t[j] !== '"') j += t[j] === '\\' ? 2 : 1;
      out += t.slice(i, j + 1);
      i = j;
    } else if ((c === '/' && t[i + 1] === '/') || c === '#') {
      while (i < t.length && t[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && t[i + 1] === '*') {
      i = t.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else out += c;
  }
  return { json: JSON.parse(out.replace(/,(\s*[\]}])/g, '$1')), lenient: true };
}

function idOf(rel) {
  const m = DATA_RE.exec(rel);
  return m ? { ns: m[1], kind: m[2], id: `${m[1]}:${m[3]}` } : null;
}

// Scans the sources and returns the evidence object (JSON-serialisable).
function scanResources(sources, { removedNamespaces = [] } = {}) {
  const ev = { schema: 1, sources: sources.map((s) => s.name), recipes: {}, loot: {}, tags: { items: {}, blocks: {}, fluids: {} }, worldgenBlocks: [], malformed: [], removedRefs: [] };
  const wg = new Set();
  const visit = (rel, text, source) => {
    const at = idOf(rel);
    let json;
    try { json = parseLenient(text).json; } catch (e) {
      ev.malformed.push({ file: rel, source, kind: at.kind, id: at.id, error: String(e.message).slice(0, 200) });
      return;
    }
    const mentions = namespaceMentions(text, removedNamespaces);
    if (mentions.length) ev.removedRefs.push({ file: rel, source, kind: at.kind, id: at.id, refs: mentions.slice(0, 20) });
    if (at.kind === 'recipes') {
      const r = { source, type: json && json.type };
      if (json && Array.isArray(json.conditions)) { r.conditions = json.conditions; r.outputs = declaredOutputs(json); }
      if (json && json.type === 'forge:conditional' && Array.isArray(json.recipes)) r.branches = json.recipes.map((b) => ({ conditions: b.conditions || [], type: b.recipe && b.recipe.type, outputs: declaredOutputs(b.recipe) }));
      ev.recipes[at.id] = r; // later (higher) sources win
    } else if (at.kind === 'loot_tables') {
      ev.loot[at.id] = { source, type: json && json.type, ...lootRefs(json || {}) };
    } else if (at.kind.startsWith('tags/')) {
      const bucket = ev.tags[at.kind.slice(5)];
      const values = Array.isArray(json && json.values) ? json.values : [];
      const prev = json && json.replace ? [] : (bucket[at.id] ? bucket[at.id].values : []);
      bucket[at.id] = {
        values: [...prev, ...values.map((v) => (typeof v === 'string' ? { id: v, required: true, source } : { id: v.id, required: v.required !== false, source }))],
        replaced: !!(json && json.replace) || !!(bucket[at.id] && bucket[at.id].replaced)
      };
    } else {
      worldgenBlocks(json, wg);
    }
  };
  for (const s of sources) {
    if (s.kind === 'jar') walkJar(fs.readFileSync(s.file), s.name, visit);
    else walkDir(s.file, 'data', s.name, visit);
  }
  ev.worldgenBlocks = [...wg].sort();
  return ev;
}

module.exports = { scanResources, parseLenient, serverSources, lootRefs, worldgenBlocks, namespaceMentions, walkJar };
