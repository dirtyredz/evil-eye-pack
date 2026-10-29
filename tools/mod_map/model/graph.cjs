'use strict';
// Resolve each node's mandatory mod-ID dependencies to the physical jars that provide them.
// The page describes the full pack, so CLIENT and SERVER edges both matter.
function connect(nodes, overrides = {}) {
  const byId = new Map(), warnings = [];
  for (const n of nodes) for (const m of n.mods) {
    if (!byId.has(m.id)) byId.set(m.id, []);
    byId.get(m.id).push(n.key);
  }
  for (const n of nodes) {
    const deps = new Set(n.dependencies);
    n.optional = [];
    n.conflicts = []; // NeoForge incompatible/discouraged declarations: never membership, never optional
    for (const m of n.mods) {
      const declared = m.dependencies;
      const kept = (overrides[m.id]?.dependencies || []).map(id => ({ id, mandatory: true, side: 'BOTH', range: '', source: 'override' }));
      for (const d of [...declared, ...kept]) {
        if (['minecraft', 'forge', 'neoforge'].includes(d.id)) continue; // the platform, never a mod node
        if (d.type === 'incompatible' || d.type === 'discouraged') { n.conflicts.push({ id: d.id, type: d.type }); continue; }
        if (!d.mandatory) { n.optional.push(d.id); continue; }
        const providers = byId.get(d.id) || [];
        if (!providers.length) warnings.push(m.id + ': missing mandatory dependency ' + d.id + ' (' + d.side + ')');
        if (!providers.includes(n.key)) for (const p of providers) deps.add(p);
        if (providers.length > 1) warnings.push(d.id + ': multiple physical providers; conservative grouping');
      }
    }
    n.dependencies = [...deps].filter(k => k !== n.key);
  }
  return warnings;
}
module.exports = { connect };
