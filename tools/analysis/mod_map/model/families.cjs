'use strict';
// Player-facing families over the connected mandatory graph, built in three named steps:
// root selection, content membership, then library ownership.
const { classifyAll, isLibrary, isContent } = require('./classify.cjs');

const byName = (a, b) => a.name.localeCompare(b.name);

function ensureSpec(specs, id, name) {
  if (!specs.has(id)) specs.set(id, { key: id, name, roots: new Set(), members: new Set(), libraries: [] });
  return specs.get(id);
}

// Step 1. Natural roots are content bases with content users, but not add-ons of another
// content mod. Overrides cover suites whose metadata does not express that shape.
function selectRoots(nodes, byKey, content, settings) {
  const contentUsers = new Map(nodes.map(n => [n.key, []]));
  for (const n of nodes.filter(content)) for (const key of n.dependencies) {
    const dependency = byKey.get(key);
    if (dependency && content(dependency)) contentUsers.get(key).push(n);
  }
  const naturalRoots = nodes.filter(n => content(n)
    && contentUsers.get(n.key).length
    && !n.dependencies.some(key => byKey.has(key) && content(byKey.get(key)))
    && settings(n).familyRoot !== false);
  const rootNodes = new Set([...naturalRoots, ...nodes.filter(n => settings(n).familyRoot === true)]);
  const specs = new Map();
  const familyId = n => settings(n).family || n.mods[0]?.id || n.key;
  for (const root of rootNodes) {
    const spec = ensureSpec(specs, familyId(root), settings(root).familyName || root.name);
    spec.roots.add(root.key); spec.members.add(root.key);
  }
  for (const n of nodes) {
    const option = settings(n);
    if (!option.family) continue;
    const spec = ensureSpec(specs, option.family, option.familyName || option.family);
    spec.members.add(n.key);
    if (option.familyRoot === true) spec.roots.add(n.key);
  }
  return specs;
}

// Step 2. Every content mod joins each family whose root it reaches through mandatory edges,
// so a bridge add-on belongs to every family it depends into.
function addContentMembers(nodes, byKey, specs, content) {
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
  for (const n of nodes.filter(content)) for (const id of reachableFamilies(n)) ensureSpec(specs, id, id).members.add(n.key);
  const memberships = new Map(nodes.map(n => [n.key, new Set()]));
  for (const spec of specs.values()) for (const key of spec.members) memberships.get(key)?.add(spec.key);
  return memberships;
}

// Step 3. A library belongs to every family whose members reach it through mandatory edges.
function assignLibraries(byKey, specs, library) {
  const dependencyClosure = starts => {
    const seen = new Set(), pending = [...starts];
    while (pending.length) {
      const n = byKey.get(pending.pop());
      if (!n) continue;
      for (const dependency of n.dependencies) if (!seen.has(dependency)) { seen.add(dependency); pending.push(dependency); }
    }
    return seen;
  };
  const libraryFamilies = new Map();
  for (const spec of specs.values()) for (const key of dependencyClosure(spec.members)) {
    const n = byKey.get(key);
    if (n && library(n)) {
      if (!libraryFamilies.has(key)) libraryFamilies.set(key, new Set());
      libraryFamilies.get(key).add(spec.key);
    }
  }
  for (const [key, owners] of libraryFamilies) for (const id of owners) specs.get(id).libraries.push(byKey.get(key));
  return libraryFamilies;
}

function familyModel(nodes, registries, overrides = {}) {
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const dependedOn = new Set(nodes.flatMap(n => n.dependencies));
  const classifications = classifyAll(nodes, registries, overrides);
  const content = n => isContent(classifications, n);
  const library = n => isLibrary(classifications, n);
  const settings = n => n.mods.map(m => overrides[m.id]).find(Boolean) || {};

  const specs = selectRoots(nodes, byKey, content, settings);
  const memberships = addContentMembers(nodes, byKey, specs, content);
  const libraryFamilies = assignLibraries(byKey, specs, library);

  const allLibraries = nodes.filter(library);
  const assigned = new Set([...memberships].filter(([, ids]) => ids.size).map(([key]) => key));
  for (const n of allLibraries) assigned.add(n.key);
  const families = [...specs.values()].map(spec => ({ ...spec,
    roots: [...spec.roots].map(key => byKey.get(key)).filter(Boolean),
    members: [...spec.members].map(key => byKey.get(key)).filter(Boolean),
    libraries: spec.libraries.sort(byName) }))
    .filter(f => f.roots.length).sort(byName);
  return { families, libraryFamilies, unusedLibraries: allLibraries.filter(n => !dependedOn.has(n.key)).sort(byName),
    ungrouped: nodes.filter(n => !assigned.has(n.key)).sort(byName), memberships, classifications };
}
module.exports = { familyModel };
