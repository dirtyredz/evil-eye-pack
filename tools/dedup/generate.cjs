'use strict';
// Run after reviewing dedup.json when a pinned jar changes. Never downloads jars.
const fs = require('node:fs');
const path = require('node:path');
const { root, scan } = require('./catalog.cjs');
const { plan } = require('./overrides.cjs');
const dirs = process.argv.slice(2);
if (!dirs.length) throw new Error('Usage: node tools/dedup/generate.cjs <cached mods directory> [...]');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'kubejs/config/dedup.json')));
const result = plan(scan(dirs).data, policy);
function write(file, json) {
  const dest = path.join(root, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(json, null, 2) + '\n');
}
write('kubejs/config/dedup.json', { ...policy, blockTagRemovals: result.blockTagRemovals });
for (const [file, json] of result.overrides) write(file, json);
write('kubejs/config/dedup_sources.json', {
  removeRecipes: result.removeRecipes, itemTags: result.itemTags, blockTags: result.blockTags
});
write('kubejs/assets/emi/index/stacks/dedup.json', {
  removed: [...Object.keys(policy.replacements), ...policy.disabled, ...policy.hiddenOnly].map(id => 'item:' + id)
});
console.log(`${result.overrides.size} recipe/loot overrides; ${result.removeRecipes.length} removed recipes`);
