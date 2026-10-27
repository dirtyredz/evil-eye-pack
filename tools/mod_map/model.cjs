'use strict';
function connect(nodes) {
  const byId = new Map(), warnings = [];
  for (const n of nodes) for (const m of n.mods) {
    if (!byId.has(m.id)) byId.set(m.id, []);
    byId.get(m.id).push(n.key);
  }
  for (const n of nodes) {
    const deps = new Set(n.dependencies);
    n.optional = [];
    for (const m of n.mods) for (const d of m.dependencies) {
      if (['minecraft', 'forge'].includes(d.id)) continue;
      if (!d.mandatory) { n.optional.push(d.id); continue; }
      // The page describes the full pack, so CLIENT and SERVER edges both matter.
      const providers = byId.get(d.id) || [];
      if (!providers.length) warnings.push(m.id + ': missing mandatory dependency ' + d.id + ' (' + d.side + ')');
      if (!providers.includes(n.key)) for (const p of providers) deps.add(p);
      if (providers.length > 1) warnings.push(d.id + ': multiple physical providers; conservative grouping');
    }
    n.dependencies = [...deps].filter(k => k !== n.key);
  }
  return warnings;
}
// Strongly connected components keep multi-jar dependency cycles as one removal unit.
function group(nodes) {
  const map = new Map(nodes.map(n => [n.key, n]));
  let next = 0; const indices = new Map(), low = new Map(), stack = [], active = new Set(), components = [];
  function visit(key) {
    indices.set(key, next); low.set(key, next++); stack.push(key); active.add(key);
    for (const dep of map.get(key).dependencies) {
      if (!map.has(dep)) continue;
      if (!indices.has(dep)) { visit(dep); low.set(key, Math.min(low.get(key), low.get(dep))); }
      else if (active.has(dep)) low.set(key, Math.min(low.get(key), indices.get(dep)));
    }
    if (low.get(key) === indices.get(key)) {
      const members = []; let k;
      do { k = stack.pop(); active.delete(k); members.push(map.get(k)); } while (k !== key);
      components.push({ key, nodes: members, dependencies: new Set(), users: [] });
    }
  }
  for (const n of nodes) if (!indices.has(n.key)) visit(n.key);
  const owner = new Map(components.flatMap(c => c.nodes.map(n => [n.key, c])));
  const incoming = new Set();
  for (const c of components) for (const n of c.nodes) for (const d of n.dependencies) {
    const dep = owner.get(d);
    if (dep && dep !== c) { c.dependencies.add(dep); incoming.add(dep); }
  }
  const tops = components.filter(c => !incoming.has(c));
  for (const top of tops) {
    const seen = new Set();
    function walk(c) { if (seen.has(c)) return; seen.add(c); c.users.push(top.key); for (const d of c.dependencies) walk(d); }
    walk(top);
  }
  return { groups: tops.map(top => ({ key: top.key, name: top.nodes.map(n => n.name).join(' + '),
    tops: top.nodes, exclusive: components.filter(c => c !== top && c.users.length === 1 && c.users[0] === top.key).flatMap(c => c.nodes),
    shared: components.filter(c => c.users.length > 1 && c.users.includes(top.key)).flatMap(c => c.nodes.map(n => n.key)),
    cycle: top.nodes.length > 1 })), shared: components.filter(c => c.users.length > 1).map(c => ({ nodes: c.nodes, users: c.users })) };
}
function classify(mod, node, dependedOn, registries, overrides = {}) {
  const override = overrides[mod.id];
  const counts = registries ? ['items', 'blocks', 'entities'].map(k => (registries[k] || []).filter(id => id.startsWith(mod.id + ':')).length) : null;
  const words = mod.name + ' ' + mod.description;
  let kind = 'utility', evidence = 'fallback; review classification';
  if (node.side === 'client') { kind = 'client-only/cosmetic'; evidence = '.pw.toml side=client'; }
  else if (/\b(performance|optimi[sz]|memory usage|lag reduction|faster loading)/i.test(words)) { kind = 'performance'; evidence = 'metadata description'; }
  else if (/\b(world gen|worldgen|biomes|terrain generation|ore generation)/i.test(words)) { kind = 'worldgen'; evidence = 'metadata description'; }
  else if (dependedOn && counts && counts.every(n => n === 0)) { kind = 'library/API'; evidence = 'mandatory users and zero item/block/entity IDs (heuristic)'; }
  else if (/\b(library|api|framework)\b/i.test(words)) { kind = 'library/API'; evidence = 'metadata description'; }
  else if (counts && counts.some(n => n > 0)) { kind = 'content'; evidence = 'live item/block/entity registrations'; }
  if (override) { kind = override.kind || kind; evidence = 'checked-in override: ' + override.reason; }
  return { kind, evidence, counts, description: override?.description || mod.description || node.name };
}
function cost(nodes, timing) {
  const ids = [...new Set(nodes.flatMap(n => n.side === 'client' ? [] : n.mods.map(m => m.id)))];
  const measured = ids.filter(id => timing.mods[id]);
  return { ms: measured.length ? measured.reduce((sum, id) => sum + timing.mods[id].ms, 0) : null, measured: measured.length, expected: ids.length };
}
module.exports = { connect, group, classify, cost };
