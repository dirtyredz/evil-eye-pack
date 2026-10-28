'use strict';
// Measured startup cost of a set of nodes: each server-side mod ID counts once; unmeasured
// mods stay unmeasured (null), never zero.
function cost(nodes, timing) {
  const ids = [...new Set(nodes.flatMap(n => n.side === 'client' ? [] : n.mods.map(m => m.id)))];
  const measured = ids.filter(id => timing.mods[id]);
  return { ms: measured.length ? measured.reduce((sum, id) => sum + timing.mods[id].ms, 0) : null, measured: measured.length, expected: ids.length };
}
module.exports = { cost };
