'use strict';
// Top-level purpose categories: categories.json maps a family or standalone mod ID to one
// category; anything unmapped stays visible under the fallback.
const { cost } = require('./cost.cjs');
const { isLibrary } = require('./classify.cjs');

const CATEGORY_NAMES = [
  'Cosmetic & Decoration',
  'Performance & Client',
  'Quality of Life & UI',
  'Tech & Automation',
  'Magic',
  'World Generation & Biomes',
  'Mobs & Adventure',
  'Colonies & Building',
  'Server & Admin',
  'Other / Uncategorised'
];
const FALLBACK_CATEGORY = CATEGORY_NAMES.at(-1);

const uniqueNodes = nodes => [...new Map(nodes.map(node => [node.key, node])).values()];
const entryKey = entry => entry.type === 'family'
  ? entry.value.key
  : entry.value.mods[0]?.id || entry.value.key;

function categorize({ families, ungrouped, classifications }, mapping, nodes, timing) {
  const byKey = new Map(nodes.map(node => [node.key, node]));
  const entries = [
    ...families.map(value => ({ type: 'family', value })),
    ...ungrouped.map(value => ({ type: 'standalone', value }))
  ];
  const buckets = new Map(CATEGORY_NAMES.map(name => [name, []]));
  const unmapped = [];
  for (const entry of entries) {
    const key = entryKey(entry);
    const requested = mapping[key];
    const category = buckets.has(requested) ? requested : FALLBACK_CATEGORY;
    if (!requested) unmapped.push(key);
    else if (!buckets.has(requested)) throw new Error(`Unknown category for ${key}: ${requested}`);
    buckets.get(category).push(entry);
  }
  return CATEGORY_NAMES.map(name => {
    const categoryEntries = buckets.get(name);
    const memberNodes = uniqueNodes(categoryEntries.flatMap(entry => entry.type === 'family'
      ? entry.value.members
      : [entry.value]));
    const libraries = uniqueNodes(categoryEntries.flatMap(entry => entry.type === 'family'
      ? entry.value.libraries
      : entry.value.dependencies.map(key => byKey.get(key)).filter(node => node && isLibrary(classifications, node))));
    const attributedNodes = uniqueNodes([...memberNodes, ...libraries]);
    return {
      name,
      entries: categoryEntries,
      memberCount: memberNodes.length,
      familyCount: categoryEntries.filter(entry => entry.type === 'family').length,
      categoryCost: cost(attributedNodes, timing)
    };
  }).filter(category => category.entries.length || category.name === FALLBACK_CATEGORY)
    .map(category => ({ ...category, unmapped: category.name === FALLBACK_CATEGORY ? unmapped : [] }));
}

module.exports = { CATEGORY_NAMES, FALLBACK_CATEGORY, categorize, entryKey };
