'use strict';
// "Should be obtainable" coverage: every expected item needs evidence of at least one obtain method.
// Evidence, strongest first: a loaded recipe output; a loaded non-block loot table (chests, entities,
// gameplay, archaeology, mod tables); a block drop of a block that worldgen places, or of a block whose
// item is itself obtainable (crops, leaves). A self-drop table alone proves nothing.
// This is evidence of an obtain method, not survival progression or recursive ingredient reachability.

const { makeFinding, sectionResult } = require('../verdict/finding.cjs');

const finding = makeFinding('acquisition');

// policy: { exclude: { ids: {id: reason}, patterns: [{ re, reason }] } } plus curated lists already merged
// into exclude.ids by the caller (dedup retirements, creative-only, MineColonies eggs).
function excluded(id, policy) {
  if (policy.exclude.ids[id]) return policy.exclude.ids[id];
  const p = policy.exclude.patterns.find((x) => new RegExp(x.re).test(id));
  return p ? p.reason : null;
}

const qualify = (id) => (id.includes(':') ? id : `minecraft:${id}`);

// Items each loot table can drop (direct item entries plus tag entries resolved through live tags).
function lootDrops(table, itemTags) {
  return [...table.items.map(qualify), ...table.tags.flatMap((t) => itemTags.get(qualify(t)) || [])];
}

// Index evidence. recipeOutputs: Map<item, recipeId[]>; loot: raw loot evidence; live: registries and tags.
function buildEvidence({ recipeOutputs, loot, live, worldgenBlocks, blockItems }) {
  const ev = new Map();
  const add = (item, kind, via) => {
    if (!ev.has(item)) ev.set(item, []);
    const list = ev.get(item);
    if (list.length < 5) list.push({ kind, via });
  };
  for (const [item, ids] of recipeOutputs) add(item, 'recipe', ids[0]);
  const blockTables = [];
  for (const [id, t] of Object.entries(loot)) {
    if (!live.lootTables.has(id)) continue; // a table that did not load proves nothing
    const block = /^([^:]+):blocks\/(.+)$/.exec(id);
    if (block) { blockTables.push({ id, block: `${block[1]}:${block[2]}`, drops: lootDrops(t, live.itemTags) }); continue; }
    const kind = /:entities\//.test(id) ? 'mob-drop' : /:chests\//.test(id) ? 'chest-loot' : /:(?:gameplay|archaeology)\//.test(id) ? 'gameplay-loot' : 'loot';
    for (const item of lootDrops(t, live.itemTags)) add(item, kind, id);
  }
  const wg = new Set(worldgenBlocks);
  for (const b of blockTables) if (wg.has(b.block)) for (const item of b.drops) add(item, 'worldgen-block-drop', b.id);
  // Fixed point: drops of blocks whose own item is obtainable some other way (leaves -> saplings, crops -> seeds).
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of blockTables) {
      const self = blockItems.get(b.block) || b.block;
      if (!ev.has(self)) continue;
      for (const item of b.drops) if (!ev.has(item)) { add(item, 'block-drop', b.id); grew = true; }
    }
  }
  // Weak: a block that drops itself (or something) but has no known way into the world. Placement by an
  // in-world interaction (waxing, stripping, oxidising, growth) is Java code the probe cannot see.
  const weak = new Map();
  for (const b of blockTables) for (const item of b.drops) if (!ev.has(item) && !weak.has(item)) weak.set(item, b.id);
  return { ev, weak };
}

// Returns { state, findings, stats }. no-known-source fails; unverified-source (only a block drop of a block
// with no known source) is info.
function checkAcquisition(input, policy) {
  const { ev, weak } = buildEvidence(input);
  const findings = [];
  const stats = { items: 0, excluded: 0, covered: 0, weak: 0, noSource: 0 };
  for (const id of [...input.live.items].sort()) {
    if (id === 'minecraft:air') continue;
    stats.items += 1;
    if (excluded(id, policy)) { stats.excluded += 1; continue; }
    const e = ev.get(id);
    if (e) { stats.covered += 1; continue; }
    if (weak.has(id)) { stats.weak += 1; findings.push(finding('unverified-source', id, weak.get(id), 'only a block drop of a block with no known source (in-world conversion or Java-placed?)', 'info')); continue; }
    stats.noSource += 1;
    findings.push(finding('no-known-source', id, null, 'no recipe, loot table or worldgen drop produces this item'));
  }
  return sectionResult(findings, stats);
}

module.exports = { checkAcquisition, buildEvidence, excluded };
