'use strict';
const { retiredIds } = require('./policy.cjs');
const { classify } = require('../../data_io/resource_layout.cjs');
// Data-only patches for custom serializers, preserving counts, chances, conditions and components.
// No inventory conversion or registry remapping. Works on either data layout: an override keeps the
// source file's own path (1.20 `recipes/` or 1.21 `recipe/`) under kubejs/.
function replace(value, replacements) {
  if (typeof value === 'string') return replacements[value] || value;
  if (Array.isArray(value)) return value.map(v => replace(v, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v, replacements)]));
  return value;
}
function plan(data, policy, blocks = new Set()) {
  const overrides = new Map(), removeRecipes = [], itemTags = {}, blockTags = {};
  const removed = new Set(retiredIds(policy));
  for (const [file, original] of data) {
    const at = classify(file);
    if (!at) continue;
    if (at.kind === 'recipes') {
      const output = JSON.stringify(original.result || original.output || original.results || original.outputs || '');
      if (policy.removeOutputs.some(id => output.includes('"' + id + '"'))) {
        removeRecipes.push(at.id);
        continue;
      }
      const rewritten = replace(original, policy.replacements);
      if (JSON.stringify(original) !== JSON.stringify(rewritten)) overrides.set('kubejs/' + file, rewritten);
    }
    if (at.kind === 'loot_tables') {
      // Change only item entries; block-state predicates still refer to the original block.
      function loot(value) {
        if (Array.isArray(value)) return value.map(loot);
        if (!value || typeof value !== 'object') return value;
        const result = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, loot(v)]));
        if ((result.type === 'minecraft:item' || result.type === 'item') && policy.replacements[result.name]) result.name = policy.replacements[result.name];
        return result;
      }
      const rewritten = loot(original);
      if (JSON.stringify(original) !== JSON.stringify(rewritten)) overrides.set('kubejs/' + file, rewritten);
    }
    if (at.kind === 'tags/items' || at.kind === 'tags/blocks') {
      const targets = original.values.map(v => typeof v === 'string' ? v : v.id)
        .filter(v => removed.has(v) && policy.replacements[v]).map(v => policy.replacements[v]);
      if (targets.length) (at.kind === 'tags/items' ? itemTags : blockTags)[at.id] = [...new Set(targets)];
    }
  }
  for (const [tag, ids] of Object.entries(policy.extraItemTags)) itemTags[tag] = [...new Set([...(itemTags[tag] || []), ...ids])];
  // Jar tag mistakes inherited through a replacement (e.g. Cluttered tags its willow door as a trapdoor).
  for (const [tag, fixes] of Object.entries(policy.tagFixes || {})) {
    if (itemTags[tag]) itemTags[tag] = [...new Set(itemTags[tag].map(id => fixes[id] || id))];
  }
  const blockTagRemovals = Object.keys(policy.replacements).filter(id => blocks.has(id));
  return { overrides, blockTagRemovals, removeRecipes: removeRecipes.sort(), itemTags, blockTags };
}
module.exports = { replace, plan };
