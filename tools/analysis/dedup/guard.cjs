'use strict';
// Duplicate-material allowance check, shared by the cached-jar test and the live pack test.
// An allowance may carry liveOnly: true when only live tags show the group (see installed.test.cjs).
// actual: { tag: [namespaces] } from catalog.duplicateGroups; allowed: allowed_groups.json.
function compareAllowances(actual, allowed) {
  const unexplained = [], changed = [], stale = [];
  for (const [tag, namespaces] of Object.entries(actual)) {
    const rule = allowed[tag];
    if (!rule || !rule.reason) unexplained.push({ tag, namespaces });
    else if (JSON.stringify(namespaces) !== JSON.stringify(rule.namespaces)) changed.push({ tag, namespaces, allowed: rule.namespaces });
  }
  for (const tag of Object.keys(allowed)) if (!actual[tag]) stale.push(tag);
  return { unexplained, changed, stale, ok: !unexplained.length && !changed.length && !stale.length };
}
module.exports = { compareAllowances };
