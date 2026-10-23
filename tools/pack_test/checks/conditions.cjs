'use strict';
// Evaluates Forge 1.20.1 data conditions against the live state the probe captured.
// state: { mods: Set, items: Set, itemTags: Map<tag, string[]> }.
// Returns { value: true|false|null (unknown condition), emptyTags: [tags whose emptiness made it false] }.

function evaluate(cond, state) {
  if (!cond || typeof cond !== 'object') return { value: null, emptyTags: [] };
  const type = String(cond.type || '').replace(/^forge:/, '');
  switch (type) {
    case 'true': return { value: true, emptyTags: [] };
    case 'false': return { value: false, emptyTags: [] };
    case 'mod_loaded': return { value: state.mods.has(cond.modid), emptyTags: [], absentMod: state.mods.has(cond.modid) ? null : cond.modid };
    case 'item_exists': return { value: state.items.has(cond.item), emptyTags: [] };
    case 'tag_empty': {
      const empty = !(state.itemTags.get(cond.tag) || []).length;
      // tag_empty true is never "gated by an empty tag"; only its negation is.
      return { value: empty, emptyTags: [], wouldGate: empty ? cond.tag : null };
    }
    case 'not': {
      const inner = evaluate(cond.value, state);
      if (inner.value === null) return inner;
      return { value: !inner.value, emptyTags: !inner.value ? [] : inner.wouldGate ? [inner.wouldGate] : [], absentMod: null };
    }
    case 'and': {
      const parts = (cond.values || []).map((c) => evaluate(c, state));
      if (parts.some((p) => p.value === false)) return { value: false, emptyTags: parts.filter((p) => p.value === false).flatMap((p) => p.emptyTags), absentMod: firstAbsent(parts.filter((p) => p.value === false)) };
      return { value: parts.some((p) => p.value === null) ? null : true, emptyTags: [] };
    }
    case 'or': {
      const parts = (cond.values || []).map((c) => evaluate(c, state));
      if (parts.some((p) => p.value === true)) return { value: true, emptyTags: [] };
      if (parts.some((p) => p.value === null)) return { value: null, emptyTags: [] };
      return { value: false, emptyTags: parts.flatMap((p) => p.emptyTags), absentMod: firstAbsent(parts) };
    }
    default: return { value: null, emptyTags: [], unknown: cond.type };
  }
}

const firstAbsent = (parts) => (parts.find((p) => p.absentMod) || {}).absentMod || null;

// A list of conditions is an implicit AND.
function evaluateAll(conditions, state) {
  return evaluate({ type: 'forge:and', values: conditions || [] }, state);
}

module.exports = { evaluate, evaluateAll };
