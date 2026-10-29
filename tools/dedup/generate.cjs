'use strict';
const { readJson } = require('../data_io/files.cjs');
const { retiredIds } = require('./policy.cjs');
// Run after reviewing dedup.json when a pinned jar changes. Never downloads jars.
// Writes the overrides, dedup_sources.json and the EMI removals, then removes generator-owned outputs
// the new run no longer produces (generated_files.cjs); hand-written data files are never touched.
// Usage: node tools/dedup/generate.cjs [--dry-run] <cached mods directory> [...]
const path = require('node:path');
const { root, scan } = require('./catalog.cjs');
const { plan } = require('./overrides.cjs');
const owned = require('./generated_files.cjs');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirs = args.filter(a => a !== '--dry-run');
if (!dirs.length) throw new Error('Usage: node tools/dedup/generate.cjs [--dry-run] <cached mods directory> [...]');
const policy = readJson(path.join(root, 'kubejs/config/dedup.json'));
const catalog = scan(dirs);
const result = plan(catalog.data, policy, catalog.blocks);
const outputs = new Map(result.overrides);
outputs.set('kubejs/config/dedup_sources.json', {
  blockTagRemovals: result.blockTagRemovals, removeRecipes: result.removeRecipes, itemTags: result.itemTags, blockTags: result.blockTags
});
outputs.set('kubejs/assets/emi/index/stacks/dedup.json', {
  removed: [...retiredIds(policy), ...policy.hiddenOnly].map(id => 'item:' + id)
});
const change = owned.reconcile(root, owned.readManifest(), outputs);
for (const rel of change.kept) console.log(`kept (edited by hand since generated): ${rel}`);
if (!dryRun) owned.apply(root, change);
console.log(`${dryRun ? 'dry run: ' : ''}${result.overrides.size} recipe/loot overrides; ${result.removeRecipes.length} removed recipes; ${change.removes.length} stale generated file(s) ${dryRun ? 'to remove' : 'removed'}`);
