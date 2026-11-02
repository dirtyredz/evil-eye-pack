'use strict';
// Pure view derivation over finished map data: family ranking, family trees, standalone cards,
// category cards and page stats. No HTML here and no re-classification: every kind comes from
// data.classifications and every category from data.categories.
const { cost } = require('../model/cost.cjs');
const { isLibrary } = require('../model/classify.cjs');

function pageView(data) {
  const { nodes, families, libraryFamilies, unusedLibraries, memberships, classifications, categories, timing, boot } = data;
  if (!classifications || !categories) throw new Error('render needs finished data: classifications and categories');
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const familyNames = new Map(families.map(f => [f.key, f.name]));
  const directUsers = n => nodes.filter(user => user.dependencies.includes(n.key));

  // One jar with its mod rows and its direct mandatory users and requirements.
  const jar = n => ({
    node: n,
    users: directUsers(n).map(user => user.name),
    needs: n.dependencies.map(key => byKey.get(key)?.name || key),
    rows: n.mods.map((mod, i) => ({ mod, classification: classifications.get(n.key)[i], timing: timing.mods[mod.id] }))
  });

  // Family tree: roots first; content members nest under their first in-family dependency and
  // libraries under each user. `others` names the other families sharing the node.
  const tree = family => {
    const rootKeys = new Set(family.roots.map(n => n.key)), libraryKeys = new Set(family.libraries.map(n => n.key));
    const children = new Map(family.members.map(n => [n.key, []]));
    for (const n of family.members.filter(n => !rootKeys.has(n.key))) {
      const parent = n.dependencies.map(key => byKey.get(key)).find(dep => dep && children.has(dep.key));
      if (parent) children.get(parent.key).push(n);
    }
    const branch = (n, seen = new Set()) => {
      if (seen.has(n.key)) return null;
      const next = new Set(seen); next.add(n.key);
      const contentOthers = [...(memberships.get(n.key) || [])].filter(id => id !== family.key).map(id => familyNames.get(id));
      const libraryOthers = [...(libraryFamilies.get(n.key) || [])].filter(id => id !== family.key).map(id => familyNames.get(id));
      const contentChildren = children.get(n.key) || [];
      const libraryChildren = n.dependencies.filter(key => libraryKeys.has(key)).map(key => byKey.get(key));
      const nested = [...contentChildren, ...libraryChildren].sort((a, b) => a.name.localeCompare(b.name)).map(child => branch(child, next)).filter(Boolean);
      return { jar: jar(n), others: contentOthers.length ? contentOthers : libraryOthers, children: nested };
    };
    return family.roots.map(n => branch(n)).filter(Boolean);
  };

  const ranked = families.map(f => ({ ...f, familyCost: cost([...f.members, ...f.libraries], timing) }))
    .sort((a, b) => (b.familyCost.ms ?? -1) - (a.familyCost.ms ?? -1) || a.name.localeCompare(b.name));
  const rankedByKey = new Map(ranked.map(family => [family.key, family]));
  const heavy = new Set(ranked.filter(f => f.familyCost.ms > 0).slice(0, 10).map(f => f.key));

  const familyEntry = source => {
    const family = rankedByKey.get(source.key);
    return { type: 'family', family, heavy: heavy.has(family.key), tree: tree(family) };
  };
  const standaloneEntry = n => {
    const libraries = n.dependencies.map(key => byKey.get(key)).filter(dep => dep && isLibrary(classifications, dep));
    return { type: 'standalone', jar: jar(n), cost: cost([n, ...libraries], timing),
      libraries: libraries.map(lib => ({ jar: jar(lib), shared: directUsers(lib).length })) };
  };

  return {
    stats: { installedJars: nodes.filter(n => !n.embedded).length, categories: categories.length, families: families.length, uniqueTotal: cost(nodes, timing) },
    bootSeconds: boot.wallSeconds,
    categories: categories.map(category => ({
      name: category.name, unmapped: category.unmapped.length, memberCount: category.memberCount, cost: category.categoryCost,
      entries: category.entries.map(entry => entry.type === 'family' ? familyEntry(entry.value) : standaloneEntry(entry.value))
    })),
    unusedLibraries: unusedLibraries.map(jar),
    warningCount: data.warnings.length + timing.warnings.length,
    provenance: { created: data.created, evidence: data.evidence, input: data.identity, boot, pins: data.pins, warnings: [...data.warnings, ...timing.warnings] },
    created: data.created,
    commit: data.identity.commit
  };
}
module.exports = { pageView };
