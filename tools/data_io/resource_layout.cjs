'use strict';
// Versioned data-pack path recognition, shared by the dedup generator and the pack test's raw scan.
// Minecraft 1.21 renamed the data folders to singular (`recipe/`, `loot_table/`, `tags/item|block|fluid`)
// and NeoForge moved its own folders from `forge/` to `neoforge/`. Callers see one canonical kind per
// folder (the 1.20 spelling, so evidence and checks stay comparable across versions) plus the layout
// the file actually used. Data conditions moved from `conditions` to `neoforge:conditions`.

// canonical kind -> [1.20 folder, 1.21 folder]
const FOLDERS = {
  recipes: ['recipes', 'recipe'],
  loot_tables: ['loot_tables', 'loot_table'],
  'tags/items': ['tags/items', 'tags/item'],
  'tags/blocks': ['tags/blocks', 'tags/block'],
  'tags/fluids': ['tags/fluids', 'tags/fluid'],
  loot_modifiers: ['loot_modifiers', 'loot_modifiers'],
  worldgen: ['worldgen', 'worldgen'],
  biome_modifier: ['forge/biome_modifier', 'neoforge/biome_modifier']
};
const LAYOUTS = ['1.20', '1.21'];
const BY_FOLDER = new Map();
for (const [kind, dirs] of Object.entries(FOLDERS)) dirs.forEach((dir, i) => {
  const prev = BY_FOLDER.get(dir);
  BY_FOLDER.set(dir, { kind, layout: prev && prev.kind === kind ? 'both' : LAYOUTS[i] });
});
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const FOLDER_ALT = [...BY_FOLDER.keys()].sort((a, b) => b.length - a.length).map(escape).join('|');
const DATA_RE = new RegExp(`^data/([^/]+)/(${FOLDER_ALT})/(.+)\\.json$`);

// The minecraft version's layout name.
function layoutFor(minecraft) {
  const [maj, min] = String(minecraft).split('.').map(Number);
  return maj > 1 || min >= 21 ? '1.21' : '1.20';
}

// { ns, kind, folder, layout ('1.20' | '1.21' | 'both'), path, id } for a data JSON path, else null.
// kinds: Set of canonical kinds to accept (default: all).
function classify(rel, kinds = null) {
  const m = DATA_RE.exec(rel);
  if (!m) return null;
  const f = BY_FOLDER.get(m[2]);
  if (kinds && !kinds.has(f.kind)) return null;
  return { ns: m[1], kind: f.kind, folder: m[2], layout: f.layout, path: m[3], id: `${m[1]}:${m[3]}` };
}

// The data path for a canonical kind in one layout.
function dataPath(layout, kind, ns, rest) {
  const dirs = FOLDERS[kind];
  if (!dirs) throw new Error(`Unknown data kind ${kind}`);
  const i = LAYOUTS.indexOf(layout);
  if (i < 0) throw new Error(`Unknown data layout ${layout}`);
  return `data/${ns}/${dirs[i]}/${rest}.json`;
}

// A matcher for walkJar selection.
const matcher = (kinds = null) => (name) => classify(name, kinds) !== null;

// The conditions a data file carries: NeoForge 1.21 `neoforge:conditions`, Forge 1.20 `conditions`.
function dataConditions(json) {
  if (!json || typeof json !== 'object') return null;
  if (Array.isArray(json['neoforge:conditions'])) return json['neoforge:conditions'];
  if (Array.isArray(json.conditions)) return json.conditions;
  return null;
}
// A condition type without its loader namespace (`forge:mod_loaded`, `neoforge:mod_loaded` -> `mod_loaded`).
const conditionType = (cond) => String((cond && cond.type) || '').replace(/^(?:neo)?forge:/, '');

module.exports = { FOLDERS, DATA_RE, layoutFor, classify, dataPath, matcher, dataConditions, conditionType };
