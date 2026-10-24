'use strict';
const { beeProductItems } = require('./bees.cjs');
const { declaredOutputs } = require('../recipe_json.cjs');

// The live state as Sets/Maps, built from the probe's registries and tags payloads.
function snapshot(sections) {
  const reg = sections.registries.data;
  const tags = sections.tags.data;
  return {
    registries: {
      items: new Set(reg.items), blocks: new Set(reg.blocks), fluids: new Set(reg.fluids), entities: new Set(reg.entities),
      mods: new Set(Object.keys(reg.mods)), lootTables: new Set(reg.lootTables), modVersions: reg.mods, recipeTypes: reg.recipeTypes
    },
    itemTags: new Map(Object.entries(tags.items)),
    blockTags: new Map(Object.entries(tags.blocks)),
    fluidTags: new Map(Object.entries(tags.fluids || {})),
    recipes: sections.recipes.ok ? sections.recipes.data : []
  };
}

function recipeOutputs(recipes, registries) {
  const out = new Map();
  for (const r of recipes) {
    const ids = new Set(r.out ? [r.out] : []);
    for (const o of declaredOutputs(r.json)) ids.add(o);
    if (registries) for (const o of beeProductItems(r, registries)) ids.add(o);
    for (const id of ids) { if (!out.has(id)) out.set(id, []); out.get(id).push(r.id); }
  }
  return out;
}

module.exports = { snapshot, recipeOutputs };
