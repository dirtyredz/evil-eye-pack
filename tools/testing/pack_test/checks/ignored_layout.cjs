'use strict';
// Data a mod ships only in the other Minecraft version's folder layout (a 1.21 jar still writing
// `loot_tables/`, `recipes/`, `tags/blocks/`) never loads. Each such file is one of:
//   covered   the same id exists in the running layout: for loot tables and recipes from any source (one file
//             wins); for tags, which merge, only the same jar's twin or the pack's kubejs/data copy counts
//   accepted  deliberately left out, with a reason in pack-test policy `ignoredLayout`
//   lost      neither: content the mod meant to add is silently absent (a failure until restored or reasoned)
// Policy keys are `<canonical kind>|<id>` or `<canonical kind>|<namespace>:*`. Pure.

const keyOf = (kind, id) => `${kind}|${id}`;

// The reason a file is accepted, or null.
function acceptedReason(accepted, kind, id) {
  return accepted[keyOf(kind, id)] || accepted[keyOf(kind, `${id.split(':')[0]}:*`)] || null;
}

// files: [{ source, kind, id }]; covered(file) -> boolean; accepted: policy map.
// Returns { covered, accepted, lost } (each a list of the files) plus `unused` policy keys that match nothing.
function triageIgnoredLayout(files, covered, accepted = {}) {
  const out = { covered: [], accepted: [], lost: [], unused: [] };
  const used = new Set();
  for (const f of files) {
    if (covered(f)) { out.covered.push(f); continue; }
    const reason = acceptedReason(accepted, f.kind, f.id);
    if (reason) {
      out.accepted.push({ ...f, reason });
      used.add(accepted[keyOf(f.kind, f.id)] ? keyOf(f.kind, f.id) : keyOf(f.kind, `${f.id.split(':')[0]}:*`));
      continue;
    }
    out.lost.push(f);
  }
  out.unused = Object.keys(accepted).filter((k) => !used.has(k)).sort();
  return out;
}

// Groups files by source jar and kind: [{ source, kind, ids }].
function groupBySource(files) {
  const groups = new Map();
  for (const f of files) {
    const key = `${f.source}|${f.kind}`;
    if (!groups.has(key)) groups.set(key, { source: f.source, kind: f.kind, ids: [] });
    groups.get(key).ids.push(f.id);
  }
  return [...groups.values()];
}

module.exports = { triageIgnoredLayout, groupBySource, acceptedReason };
