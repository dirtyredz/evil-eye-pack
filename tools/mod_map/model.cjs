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
function familyModel(nodes, registries, overrides = {}) {
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const dependedOn = new Set(nodes.flatMap(n => n.dependencies));
  const classifications = new Map(nodes.map(n => [n.key, n.mods.map(m => classify(m, n, dependedOn.has(n.key), registries, overrides))]));
  const isContent = n => classifications.get(n.key).some(c => c.kind === 'content' || c.kind === 'worldgen');
  const isLibrary = n => classifications.get(n.key).length > 0 && classifications.get(n.key).every(c => c.kind === 'library/API');
  const settings = n => n.mods.map(m => overrides[m.id]).find(Boolean) || {};
  const contentUsers = new Map(nodes.map(n => [n.key, []]));
  for (const n of nodes.filter(isContent)) for (const key of n.dependencies) {
    const dependency = byKey.get(key);
    if (dependency && isContent(dependency)) contentUsers.get(key).push(n);
  }

  // Natural roots are content bases with content users, but not add-ons of another
  // content mod. Overrides cover suites whose metadata does not express that shape.
  const naturalRoots = nodes.filter(n => isContent(n)
    && contentUsers.get(n.key).length
    && !n.dependencies.some(key => byKey.has(key) && isContent(byKey.get(key)))
    && settings(n).familyRoot !== false);
  const rootNodes = new Set([...naturalRoots, ...nodes.filter(n => settings(n).familyRoot === true)]);
  const specs = new Map();
  const ensure = (id, name) => {
    if (!specs.has(id)) specs.set(id, { key: id, name, roots: new Set(), members: new Set(), libraries: [], shared: [] });
    return specs.get(id);
  };
  const familyId = n => settings(n).family || n.mods[0]?.id || n.key;
  for (const root of rootNodes) {
    const id = familyId(root), option = settings(root);
    const spec = ensure(id, option.familyName || root.name);
    spec.roots.add(root.key); spec.members.add(root.key);
  }
  for (const n of nodes) {
    const option = settings(n);
    if (!option.family) continue;
    const spec = ensure(option.family, option.familyName || option.family);
    spec.members.add(n.key);
    if (option.familyRoot === true) spec.roots.add(n.key);
  }

  const rootsByKey = new Map();
  for (const spec of specs.values()) for (const key of spec.roots) rootsByKey.set(key, spec.key);
  const reachableFamilies = (start, visiting = new Set()) => {
    if (visiting.has(start.key)) return new Set();
    const found = new Set(rootsByKey.has(start.key) ? [rootsByKey.get(start.key)] : []);
    const next = new Set(visiting); next.add(start.key);
    for (const key of start.dependencies) {
      const dependency = byKey.get(key);
      if (dependency) for (const id of reachableFamilies(dependency, next)) found.add(id);
    }
    return found;
  };
  for (const n of nodes.filter(isContent)) for (const id of reachableFamilies(n)) ensure(id, id).members.add(n.key);

  const memberships = new Map(nodes.map(n => [n.key, new Set()]));
  for (const spec of specs.values()) for (const key of spec.members) memberships.get(key)?.add(spec.key);
  const dependencyClosure = starts => {
    const seen = new Set(), pending = [...starts];
    while (pending.length) {
      const key = pending.pop();
      const n = byKey.get(key);
      if (!n) continue;
      for (const dependency of n.dependencies) if (!seen.has(dependency)) { seen.add(dependency); pending.push(dependency); }
    }
    return seen;
  };
  const libraryOwners = new Map();
  for (const spec of specs.values()) for (const key of dependencyClosure(spec.members)) {
    const n = byKey.get(key);
    if (n && isLibrary(n)) {
      if (!libraryOwners.has(key)) libraryOwners.set(key, new Set());
      libraryOwners.get(key).add(spec.key);
    }
  }
  const outsideLibraries = new Set();
  for (const n of nodes.filter(n => memberships.get(n.key).size === 0 && !isLibrary(n))) {
    for (const key of dependencyClosure([n.key])) if (libraryOwners.has(key)) outsideLibraries.add(key);
  }
  const sharedLibraries = [];
  for (const [key, owners] of libraryOwners) {
    const n = byKey.get(key);
    if (owners.size === 1 && !outsideLibraries.has(key)) specs.get([...owners][0]).libraries.push(n);
    else {
      sharedLibraries.push({ node: n, families: [...owners] });
      for (const id of owners) specs.get(id).shared.push(key);
    }
  }
  const assigned = new Set([...memberships].filter(([, ids]) => ids.size).map(([key]) => key));
  for (const spec of specs.values()) for (const n of spec.libraries) assigned.add(n.key);
  for (const item of sharedLibraries) assigned.add(item.node.key);
  const families = [...specs.values()].map(spec => ({ ...spec,
    roots: [...spec.roots].map(key => byKey.get(key)).filter(Boolean),
    members: [...spec.members].map(key => byKey.get(key)).filter(Boolean),
    libraries: spec.libraries.sort((a, b) => a.name.localeCompare(b.name)),
    shared: spec.shared.map(key => byKey.get(key)).filter(Boolean) }))
    .filter(f => f.roots.length).sort((a, b) => a.name.localeCompare(b.name));
  return { families, sharedLibraries: sharedLibraries.sort((a, b) => a.node.name.localeCompare(b.node.name)),
    ungrouped: nodes.filter(n => !assigned.has(n.key)).sort((a, b) => a.name.localeCompare(b.name)), memberships, classifications };
}
module.exports = { connect, classify, cost, familyModel };
