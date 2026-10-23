'use strict';
// Data-only patches for custom serializers, preserving counts, chances and conditions.
// No inventory conversion or registry remapping.
function replace(value, replacements) {
  if (typeof value === 'string') return replacements[value] || value;
  if (Array.isArray(value)) return value.map(v => replace(v, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replace(v, replacements)]));
  return value;
}
function plan(data, policy) {
  const overrides = new Map(), removeRecipes = [], itemTags = {}, blockTags = {};
  const removed = new Set([...Object.keys(policy.replacements), ...policy.disabled]);
  for (const [file, original] of data) {
    const recipe = file.match(/^data\/([^/]+)\/recipes\/(.+)\.json$/);
    if (recipe) {
      const output = JSON.stringify(original.result || original.output || original.results || original.outputs || '');
      if (policy.removeOutputs.some(id => output.includes('"' + id + '"'))) {
        removeRecipes.push(recipe[1] + ':' + recipe[2]);
        continue;
      }
      const rewritten = replace(original, policy.replacements);
      if (JSON.stringify(original) !== JSON.stringify(rewritten)) overrides.set('kubejs/' + file, rewritten);
    }
    if (file.includes('/loot_tables/')) {
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
    const tag = file.match(/^data\/([^/]+)\/tags\/(items|blocks)\/(.+)\.json$/);
    if (tag) {
      const targets = original.values.map(v => typeof v === 'string' ? v : v.id)
        .filter(v => removed.has(v) && policy.replacements[v]).map(v => policy.replacements[v]);
      if (targets.length) (tag[2] === 'items' ? itemTags : blockTags)[tag[1] + ':' + tag[3]] = [...new Set(targets)];
    }
  }
  for (const [tag, ids] of Object.entries(policy.extraItemTags)) itemTags[tag] = [...new Set([...(itemTags[tag] || []), ...ids])];
  return { overrides, removeRecipes: removeRecipes.sort(), itemTags, blockTags };
}
module.exports = { replace, plan };
