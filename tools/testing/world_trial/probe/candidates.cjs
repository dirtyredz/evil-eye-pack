'use strict';
// World-trial target policy: which chunks of an offline world are candidates for a probe visit,
// and why. Fed by the neutral `visit(document, context)` hook of data_io/world/inventory.cjs; the
// shared reader knows nothing about trials, probe reasons or ported-mod namespaces.
// plan.cjs then narrows these candidates to what the trial actually visits.
const PORT_BLOCKS = /^(iceandfire|roundwood|ars_instrumentum|alexsmobs|alexscaves):/;

function candidateCollector() {
  const targets = new Map();
  function target(dimension, x, z, reason) {
    const key = dimension + ':' + x + ':' + z;
    if (!targets.has(key)) targets.set(key, { dimension, x, z, reasons: [] });
    const row = targets.get(key);
    if (!row.reasons.includes(reason)) row.reasons.push(reason);
  }
  function document(v, file) {
    const p = v.Data?.Player || v;
    if (Array.isArray(p.Pos) && typeof p.Dimension === 'string') target(p.Dimension, Math.floor(p.Pos[0] / 16), Math.floor(p.Pos[2] / 16), 'player');
    if (file === 'level.dat') target('minecraft:overworld', Math.floor(v.Data.SpawnX / 16), Math.floor(v.Data.SpawnZ / 16), 'spawn');
  }
  function chunk(nbt, dim, [cx, cz], blockIds) {
    const n = nbt.Level || nbt;
    for (const _ of n.Entities || n.entities || []) target(dim, cx, cz, 'entity');
    for (const _ of n.block_entities || n.TileEntities || []) target(dim, cx, cz, 'block entity');
    // blockIds: ids the inventory decoded from the chunk palettes (a malformed palette is reported by the inventory itself)
    for (const id of blockIds) if (PORT_BLOCKS.test(id)) { target(dim, cx, cz, 'port blocks'); break; }
  }
  return {
    visit(v, context) { if (context.chunk) chunk(v, context.dimension, context.chunk, context.blockIds || []); else document(v, context.file); },
    targets: () => [...targets.values()].sort((a, b) => a.dimension.localeCompare(b.dimension) || a.x - b.x || a.z - b.z)
  };
}
module.exports = { candidateCollector, PORT_BLOCKS };
