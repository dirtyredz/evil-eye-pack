'use strict';
// Pure extraction from raw Minecraft data JSON.

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

module.exports = { lootRefs, worldgenBlocks, parseLenient };
