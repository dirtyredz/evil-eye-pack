'use strict';
// Pure readers over recipe JSON, shared by the session scan (raw data), the checks and the analysis:
// no I/O, no dependency on checks or session.

// A namespaced resource id such as `minecraft:stone` (bare ids some mods use for non-item results included).
const RESOURCE_ID = /^[a-z0-9_.-]+:[a-z0-9_/.-]+$/;
const isResourceId = (v) => typeof v === 'string' && RESOURCE_ID.test(v);

// The tags and items an ingredient JSON names (alternatives included). null when it is a custom type.
function ingredientRefs(j) {
  let v;
  try { v = JSON.parse(j); } catch { return null; }
  const alts = Array.isArray(v) ? v : [v];
  const out = { tags: [], items: [], custom: [] };
  for (const a of alts) {
    if (a && typeof a === 'object' && typeof a.tag === 'string') out.tags.push(a.tag);
    else if (a && typeof a === 'object' && typeof a.item === 'string') out.items.push(a.item);
    else out.custom.push(a && a.type ? a.type : 'unknown');
  }
  return out;
}

// Outputs a recipe JSON declares (nested and probabilistic outputs included; fluids skipped; Create's
// sequenced-assembly transitionalItem counts, since players hold it mid-assembly), each with its form:
// 'object' ({ item }/{ id } stacks, unambiguously items) or 'string' (a bare id, which some mods use for
// non-item results such as Productive Bees' bee types).
function declaredOutputRefs(json) {
  const refs = new Map();
  const add = (id, form) => { if (!refs.has(id) || form === 'object') refs.set(id, form); };
  const take = (v) => {
    if (typeof v === 'string') { if (isResourceId(v)) add(v, 'string'); return; }
    if (Array.isArray(v)) { v.forEach(take); return; }
    if (!v || typeof v !== 'object') return;
    if (v.fluid !== undefined || v.fluidTag !== undefined || v.FluidName !== undefined) return;
    if (typeof v.item === 'string') add(v.item, 'object');
    else if (typeof v.id === 'string' && (v.count !== undefined || v.Count !== undefined || v.chance !== undefined || Object.keys(v).length <= 3)) add(v.id, 'object');
    for (const k of ['item', 'result', 'results', 'output', 'outputs']) if (v[k] && typeof v[k] === 'object') take(v[k]);
  };
  if (json && typeof json === 'object') for (const k of ['result', 'results', 'output', 'outputs', 'transitionalItem']) if (json[k] !== undefined) take(json[k]);
  return [...refs].map(([id, form]) => ({ id, form }));
}

const declaredOutputs = (json) => declaredOutputRefs(json).map((r) => r.id);

module.exports = { ingredientRefs, declaredOutputRefs, declaredOutputs, isResourceId };
