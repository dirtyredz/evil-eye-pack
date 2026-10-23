'use strict';
// Productive Bees recipes whose "output" is a bee type, not an item. A bee_conversion recipe's `result` and a
// bee_breeding recipe's `offspring` are bee type ids (e.g. productivebees:rose_quartz): data-driven types that
// exist only as the `type` NBT of the one configurable bee entity, so no registry holds them. The player holds
// the product as the configurable spawn egg (EntityTag.type = the bee) and later as that bee's combs.

const BEE_OUTPUT_KEYS = {
  'productivebees:bee_conversion': ['result'],
  'productivebees:bee_breeding': ['offspring']
};
const CONFIGURABLE_ENTITY = 'productivebees:configurable_bee';
const CONFIGURABLE_EGG = 'productivebees:spawn_egg_configurable_bee';

// Bee type ids a recipe JSON produces; empty for every other recipe type.
function beeOutputs(type, json) {
  const keys = BEE_OUTPUT_KEYS[type];
  if (!keys || !json || typeof json !== 'object') return [];
  return keys.flatMap((k) => (Array.isArray(json[k]) ? json[k] : [json[k]]))
    .filter((v) => typeof v === 'string' && /^[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(v));
}

// True when `id` is one of the recipe's bee outputs and the pack registers the configurable bee that carries it.
function isBeeOutput(recipe, id, registries) {
  return registries.entities.has(CONFIGURABLE_ENTITY) && beeOutputs(recipe.type, recipe.json).includes(id);
}

// The item evidence such a recipe gives: the configurable spawn egg, when it exists.
function beeProductItems(recipe, registries) {
  return beeOutputs(recipe.type, recipe.json).length && registries.items.has(CONFIGURABLE_EGG) ? [CONFIGURABLE_EGG] : [];
}

module.exports = { beeOutputs, isBeeOutput, beeProductItems, CONFIGURABLE_ENTITY, CONFIGURABLE_EGG };
