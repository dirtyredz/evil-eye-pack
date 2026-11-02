'use strict';
// Raw server data resources, read from the installed throwaway server before it boots: vanilla's data jar,
// the loader's universal jar, every mod jar (and its jar-in-jar libraries) and the KubeJS data folder.
// Extracts only what the checks need (recipe conditions, loot references, tag files, worldgen blocks,
// removed-namespace mentions) into one evidence file, so a run can be re-analysed later without the jars.
// Both data layouts are read (1.20 plural and 1.21 singular folders, `conditions` and
// `neoforge:conditions`); evidence keeps the canonical 1.20 kind names. An empty scan is an error.
//
// Precedence is approximated: KubeJS data > mod jars (alphabetical) > loader > vanilla. For tags every
// source is merged (respecting `replace`); for recipes and loot tables the highest source wins.
const fs = require('node:fs');
const path = require('node:path');
const { walkJar } = require('../../../data_io/walk.cjs');
const { classify, dataConditions, layoutFor } = require('../../../data_io/resource_layout.cjs');
const { readStamp } = require('../../server_smoke/runtime/runtime.cjs');
const { packConfigFiles } = require('../verdict/policy.cjs');
const { declaredOutputs } = require('../recipe_json.cjs');
const { lootRefs, worldgenBlocks, parseLenient } = require('./extract.cjs');

const KINDS = new Set(['recipes', 'loot_tables', 'tags/items', 'tags/blocks', 'tags/fluids', 'worldgen', 'biome_modifier']);
const isData = (rel) => classify(rel, KINDS) !== null;
// The loader's own data jar (Forge or NeoForge universal), by library folder.
const LOADER_LIBRARIES = [['forge', 'libraries/net/minecraftforge/forge'], ['neoforge', 'libraries/net/neoforged/neoforge']];

function walkDir(dir, rel, source, visit) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) walkDir(p, r, source, visit);
    else if (isData(r)) visit(r, fs.readFileSync(p, 'utf8'), source);
  }
}

// The data sources of an installed server, lowest precedence first: vanilla, the loader, mods, KubeJS.
function serverSources(serverDir) {
  const out = [];
  const vanilla = path.join(serverDir, 'libraries/net/minecraft/server');
  if (fs.existsSync(vanilla)) {
    for (const v of fs.readdirSync(vanilla)) {
      for (const f of fs.readdirSync(path.join(vanilla, v))) if (/-extra\.jar$/.test(f)) out.push({ kind: 'jar', name: 'minecraft', file: path.join(vanilla, v, f) });
    }
  }
  for (const [name, rel] of LOADER_LIBRARIES) {
    const dir = path.join(serverDir, rel);
    if (!fs.existsSync(dir)) continue;
    for (const v of fs.readdirSync(dir)) {
      for (const f of fs.readdirSync(path.join(dir, v))) if (/-universal\.jar$/.test(f)) out.push({ kind: 'jar', name, file: path.join(dir, v, f) });
    }
  }
  const mods = path.join(serverDir, 'mods');
  if (fs.existsSync(mods)) for (const f of fs.readdirSync(mods).filter((x) => x.endsWith('.jar')).sort()) out.push({ kind: 'jar', name: f, file: path.join(mods, f) });
  out.push({ kind: 'dir', name: 'kubejs', file: path.join(serverDir, 'kubejs/data') });
  return out;
}

// Every namespaced id mentioned in a JSON document whose namespace is in `namespaces`.
function namespaceMentions(text, namespaces) {
  if (!namespaces.length) return [];
  const re = new RegExp(`["#](${namespaces.map((n) => n.replace(/[^a-z0-9_]/g, '')).join('|')}):[a-z0-9_/.-]+`, 'g');
  return [...new Set((text.match(re) || []).map((m) => m.slice(1)))];
}

// Text files a player receives (configs, KubeJS) that still name a removed mod.
function shippedMentions(serverDir, namespaces) {
  const out = [];
  if (!namespaces.length) return out;
  const re = new RegExp(`(?:${namespaces.join('|')}):`);
  for (const dir of ['config', 'defaultconfigs', 'kubejs']) {
    const abs = path.join(serverDir, dir);
    if (!fs.existsSync(abs)) continue;
    for (const e of fs.readdirSync(abs, { recursive: true, withFileTypes: true })) {
      if (!e.isFile() || !/\.(json|json5|toml|cfg|txt|js|properties|yaml|yml)$/.test(e.name)) continue;
      const file = path.join(e.parentPath, e.name);
      const text = fs.readFileSync(file, 'utf8');
      if (!re.test(text)) continue;
      const refs = [...new Set((text.match(new RegExp(`(?:${namespaces.join('|')}):[a-z0-9_/.-]+`, 'g')) || []))];
      out.push({ file: path.relative(serverDir, file).replace(/\\/g, '/'), refs: refs.length ? refs : namespaceMentions(text, namespaces) });
    }
  }
  return out;
}

// Scans the sources and returns the evidence object (JSON-serialisable). minecraft: the server's version;
// data in the other version's folders (a 1.21 jar still shipping loot_tables/) is never loaded by that
// game, so it is recorded in ignoredLayout instead of being treated as pack data.
function scanResources(sources, { removedNamespaces = [], minecraft = null } = {}) {
  const ev = { schema: 1, sources: sources.map((s) => s.name), recipes: {}, loot: {}, tags: { items: {}, blocks: {}, fluids: {} }, worldgenBlocks: [], malformed: [], removedRefs: [], ignoredLayout: [] };
  const runtimeLayout = minecraft ? layoutFor(minecraft) : null;
  const wg = new Set();
  const layouts = new Set();
  const visit = (rel, text, source) => {
    const at = classify(rel, KINDS);
    if (runtimeLayout && at.layout !== 'both' && at.layout !== runtimeLayout) { ev.ignoredLayout.push({ file: rel, source, kind: at.kind, id: at.id }); return; }
    layouts.add(at.layout);
    let json;
    try { json = parseLenient(text).json; } catch (e) {
      ev.malformed.push({ file: rel, source, kind: at.kind, id: at.id, error: String(e.message).slice(0, 200) });
      return;
    }
    const mentions = namespaceMentions(text, removedNamespaces);
    if (mentions.length) ev.removedRefs.push({ file: rel, source, kind: at.kind, id: at.id, refs: mentions.slice(0, 20) });
    if (at.kind === 'recipes') {
      const r = { source, type: json && json.type };
      const conditions = dataConditions(json);
      if (conditions) { r.conditions = conditions; r.outputs = declaredOutputs(json); }
      // Forge 1.20's wrapper type; NeoForge 1.21 has no conditional recipe type.
      if (json && json.type === 'forge:conditional' && Array.isArray(json.recipes)) r.branches = json.recipes.map((b) => ({ conditions: b.conditions || [], type: b.recipe && b.recipe.type, outputs: declaredOutputs(b.recipe) }));
      ev.recipes[at.id] = r; // later (higher) sources win
    } else if (at.kind === 'loot_tables') {
      const conditions = dataConditions(json);
      ev.loot[at.id] = { source, type: json && json.type, ...(conditions ? { conditions } : {}), ...lootRefs(json || {}) };
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
    if (s.kind === 'jar') walkJar(fs.readFileSync(s.file), s.name, visit, { matches: isData, nested: true });
    else walkDir(s.file, 'data', s.name, visit);
  }
  ev.worldgenBlocks = [...wg].sort();
  ev.layouts = [...layouts].sort();
  return ev;
}

// An empty scan means the wrong data layout or missing jars, never a clean result.
function assertNonEmpty(ev) {
  const empty = ['recipes', 'loot'].filter((k) => !Object.keys(ev[k]).length);
  if (!Object.keys(ev.tags.items).length) empty.push('item tags');
  if (empty.length) throw new Error(`raw resource scan found no ${empty.join(', ')} (sources: ${ev.sources.join(', ') || 'none'}); refusing an empty scan`);
  return ev;
}

// Raw resources, shipped-config mentions and the pack's own policy files, read from the staged server.
function writeResourceScan(stageDir, evidenceDir, data) {
  fs.mkdirSync(path.join(evidenceDir, 'pack-config'), { recursive: true });
  const stamp = readStamp(stageDir);
  const ev = assertNonEmpty(scanResources(serverSources(stageDir), { removedNamespaces: data.policy.removedMods, minecraft: stamp ? stamp.minecraft : null }));
  ev.shipped = shippedMentions(stageDir, data.policy.removedMods);
  fs.writeFileSync(path.join(evidenceDir, 'resources.json'), JSON.stringify(ev));
  for (const f of packConfigFiles(data.policy)) fs.copyFileSync(path.join(stageDir, f), path.join(evidenceDir, 'pack-config', path.basename(f)));
}

module.exports = { writeResourceScan, scanResources, assertNonEmpty, shippedMentions, serverSources, namespaceMentions };
