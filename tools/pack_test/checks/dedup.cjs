'use strict';
// The duplicate-material guard applied to the LIVE tags, plus the dedup policy's own promises:
// retired copies carry no tag, survivors carry theirs, and retired producer recipes stay removed.
const { duplicateGroups } = require('../../dedup/catalog.cjs');
const { compareAllowances } = require('../../dedup/guard.cjs');

const finding = (code, subject, ref, message, severity = 'fail') => ({ check: 'dedup', code, subject, ref, message, severity });

// itemTags: Map<tag, item[]>; liveRecipeIds: Set; policy: dedup.json; sources: dedup_sources.json; allowed: allowed_groups.json.
function checkDedup(itemTags, liveRecipeIds, { policy, sources, allowed }) {
  const findings = [];
  const groups = duplicateGroups(itemTags);
  const cmp = compareAllowances(groups, allowed);
  for (const g of cmp.unexplained) findings.push(finding('duplicate-material-group', `#${g.tag}`, g.namespaces.join(','), 'new duplicate material group in live tags'));
  for (const g of cmp.changed) findings.push(finding('duplicate-group-changed', `#${g.tag}`, g.namespaces.join(','), `allowed namespaces are ${g.allowed.join(',')}`));
  for (const tag of cmp.stale) findings.push(finding('stale-allowance', `#${tag}`, null, 'allowed_groups.json exception no longer needed'));
  const retired = new Set([...Object.keys(policy.replacements), ...policy.disabled]);
  for (const [tag, items] of itemTags) for (const id of items) if (retired.has(id)) findings.push(finding('retired-item-tagged', id, `#${tag}`, 'retired duplicate still carries a live tag'));
  for (const [tag, ids] of Object.entries(sources.itemTags)) {
    const live = new Set(itemTags.get(tag) || []);
    for (const id of ids) if (!live.has(id)) findings.push(finding('survivor-tag-missing', id, `#${tag}`, 'survivor does not carry the tag the policy gives it'));
  }
  for (const id of sources.removeRecipes) if (liveRecipeIds.has(id)) findings.push(finding('retired-recipe-loaded', id, null, 'retired producer recipe is loaded'));
  return { state: findings.some((f) => f.severity === 'fail') ? 'findings' : 'passed', findings, stats: { groups: Object.keys(groups).length, allowed: Object.keys(allowed).length, survivorTags: Object.keys(sources.itemTags).length, removedRecipes: sources.removeRecipes.length } };
}

module.exports = { checkDedup };
