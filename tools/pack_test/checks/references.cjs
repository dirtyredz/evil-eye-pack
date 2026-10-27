'use strict';
// Tags, loot tables and removed-mod references. Pure over the raw evidence and the live registries.
// Registry existence is a Set lookup, so an unknown id can never fall back to air.

const { makeFinding, sectionResult } = require('../verdict/finding.cjs');

const finding = makeFinding('references');

// Ids without a namespace mean minecraft:, as in the game.
const qualify = (id) => (id.includes(':') ? id : `minecraft:${id}`);

// Raw tag files: a required reference to a missing entry makes Minecraft drop the whole tag. liveTags: tags
// that exist at runtime (including ones made by code); dropped: tags the log already reports as dropped.
function checkTags(rawTags, registry, liveTags, kind, findings, stats, dropped = new Set()) {
  for (const [tag, def] of Object.entries(rawTags)) {
    stats[`${kind}Tags`] = (stats[`${kind}Tags`] || 0) + 1;
    if (dropped.has(tag)) continue;
    for (const v of def.values) {
      const isTag = v.id.startsWith('#');
      const ref = isTag ? qualify(v.id.slice(1)) : qualify(v.id);
      const exists = isTag ? liveTags.has(ref) || Object.prototype.hasOwnProperty.call(rawTags, ref) : registry.has(ref);
      if (exists) continue;
      if (!v.required) stats.optionalAbsent = (stats.optionalAbsent || 0) + 1;
      else if (liveTags.has(tag)) findings.push(finding('tag-reference-unresolved', `#${tag}`, ref, `${kind} tag names a missing ${isTag ? 'tag' : 'entry'} (from ${v.source}) yet loaded`, 'info'));
      else findings.push(finding('tag-missing-reference', `#${tag}`, ref, `${kind} tag requires a missing ${isTag ? 'tag' : 'entry'} (from ${v.source}); the game drops the whole tag`));
    }
  }
}

// Nested loot-table references form a graph; a cycle loops forever when the table rolls.
function lootCycles(loot) {
  const cycles = [];
  const state = new Map();
  const visit = (id, stack) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) { cycles.push(stack.slice(stack.indexOf(id)).concat(id)); return; }
    state.set(id, 1);
    for (const t of (loot[id] && loot[id].tables) || []) visit(t, stack.concat(id));
    state.set(id, 2);
  };
  Object.keys(loot).sort().forEach((id) => visit(id, []));
  return cycles;
}

// logFailed: loot tables the log reports as unparseable (the log check owns those findings).
function checkLoot(loot, live, findings, stats, logFailed = new Set()) {
  const liveTables = live.lootTables;
  for (const [id, t] of Object.entries(loot)) {
    stats.lootTables = (stats.lootTables || 0) + 1;
    const items = t.items.map(qualify);
    const missingItems = items.filter((i) => !live.items.has(i));
    if (!liveTables.has(id)) {
      if (logFailed.has(id)) continue;
      // A table for compat content whose items were never registered (Steam 'n' Rails tracks for absent wood mods).
      if (missingItems.length && missingItems.length === items.length) { stats.lootOptionalCompat = (stats.lootOptionalCompat || 0) + 1; continue; }
      findings.push(finding('loot-not-loaded', id, t.source, 'loot table present in data but not loaded'));
      continue;
    }
    for (const i of missingItems) findings.push(finding('loot-missing-item', id, i, 'loot entry names an unregistered item'));
    for (const g of t.tags.map(qualify)) if (!live.itemTags.has(g)) findings.push(finding('loot-missing-tag', id, `#${g}`, 'loot tag entry names a tag that does not exist'));
    for (const n of t.tables.map(qualify)) if (!liveTables.has(n) && !(n === 'minecraft:empty')) findings.push(finding('loot-missing-table', id, n, 'nested loot table does not exist'));
    for (const b of t.blocks.map(qualify)) if (!live.blocks.has(b)) findings.push(finding('loot-missing-block', id, b, 'block predicate names an unregistered block'));
    if (t.opaque.length) stats.opaqueEntries = (stats.opaqueEntries || 0) + 1;
  }
  for (const c of lootCycles(loot)) findings.push(finding('loot-cycle', c[0], c.join(' > '), 'nested loot tables reference each other in a cycle'));
}

// removed: retired mod ids. Mentions in active data and shipped config, plus any live registry entry.
function checkRemoved(resources, shipped, live, removed, findings) {
  for (const r of resources.removedRefs || []) for (const ref of r.refs) findings.push(finding('removed-mod-reference', r.id, ref, `${r.kind} in ${r.source} still names a removed mod`));
  for (const s of shipped || []) for (const ref of s.refs) findings.push(finding('removed-mod-reference', s.file, ref, 'shipped file names a removed mod'));
  const ns = new Set(removed);
  for (const reg of ['items', 'blocks']) for (const id of live[reg]) if (ns.has(id.split(':')[0])) findings.push(finding('removed-mod-registered', id, reg, 'a removed mod still registers content'));
  for (const m of removed) if (live.mods.has(m)) findings.push(finding('removed-mod-loaded', m, null, 'a removed mod is still loaded'));
}

function checkRequired(live, required, findings) {
  for (const m of required) if (!live.mods.has(m)) findings.push(finding('required-mod-missing', m, null, 'a pack-required mod did not load'));
}

// live: { items, blocks, fluids, mods, lootTables (Sets), itemTags, blockTags, fluidTags (Maps) }.
// shipped: [{ file, refs }]. logged: { droppedTags, failedLoot } (Sets) already reported by the log check.
function checkReferences(resources, live, { removed = [], required = [], shipped = [], logged = {} } = {}) {
  const findings = [];
  const stats = {};
  const dropped = logged.droppedTags || new Set();
  checkTags(resources.tags.items, live.items, live.itemTags, 'item', findings, stats, dropped);
  checkTags(resources.tags.blocks, live.blocks, live.blockTags || new Map(), 'block', findings, stats, dropped);
  checkTags(resources.tags.fluids || {}, live.fluids, live.fluidTags || new Map(), 'fluid', findings, stats, dropped);
  checkLoot(resources.loot, live, findings, stats, logged.failedLoot || new Set());
  checkRemoved(resources, shipped, live, removed, findings);
  checkRequired(live, required, findings);
  for (const m of resources.malformed || []) {
    if (m.kind === 'recipes') continue; // reported by the recipe check
    findings.push(finding('resource-malformed-json', m.id, m.source, `${m.kind}: ${m.error}`));
  }
  return sectionResult(findings, stats);
}

module.exports = { checkReferences, lootCycles, checkTags, qualify };
