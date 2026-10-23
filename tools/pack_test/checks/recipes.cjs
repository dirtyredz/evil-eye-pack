'use strict';
// Loaded-recipe resolution and raw-resource reconciliation. Pure: works on the probe snapshot and the
// raw resource evidence, so `--analyze` gives the same answer later.
//
// live recipe: { id, type, special, shaped, ings: [{ j, n, empty, barrier }], out, outCount, json? }
//   j: the ingredient's toJson() text; n: matching stacks; empty: Ingredient.isEmpty();
//   barrier: every match is the "Empty Tag" barrier placeholder Forge substitutes for an empty tag.
const { evaluateAll } = require('./conditions.cjs');
const { isBeeOutput } = require('./bees.cjs');

const finding = (code, subject, ref, message, severity = 'fail', evidence) => ({ check: 'recipes', code, subject, ref, message, severity, evidence });

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
    if (typeof v === 'string') { if (/^[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(v)) add(v, 'string'); return; }
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

function checkLive(recipes, reg, tags) {
  const findings = [];
  const stats = { loaded: recipes.length, ingredients: 0, blankSlots: 0, customIngredients: 0, unsupportedOutputs: 0, beeOutputs: 0 };
  for (const r of recipes) {
    for (const ing of r.ings || []) {
      stats.ingredients += 1;
      if (ing.empty) { stats.blankSlots += 1; continue; } // a shaped blank slot, or an optional machine slot
      const refs = ingredientRefs(ing.j);
      if (refs && !refs.custom.length) {
        const live = refs.items.filter((i) => reg.items.has(i)).length + refs.tags.filter((t) => (tags.get(t) || []).length).length;
        if (!live) {
          if (refs.tags.length) refs.tags.forEach((t) => findings.push(finding('ingredient-empty-tag', r.id, `#${t}`, `${r.type}: no item carries #${t}`)));
          else findings.push(finding('ingredient-unsatisfiable', r.id, refs.items.join('|'), `${r.type}: ingredient items are not registered`));
        }
      } else {
        stats.customIngredients += 1;
        if (!ing.n || ing.barrier) findings.push(finding('ingredient-unsatisfiable', r.id, refs ? refs.custom.join('|') : ing.j.slice(0, 80), `${r.type}: custom ingredient matches no registered item`));
      }
    }
    const outs = new Map(r.out && r.out !== 'minecraft:air' ? [[r.out, 'object']] : []);
    for (const o of declaredOutputRefs(r.json)) if (!outs.has(o.id) || o.form === 'object') outs.set(o.id, o.form);
    for (const [o, form] of outs) {
      if (reg.items.has(o) || reg.fluids.has(o)) continue;
      if (form === 'string' && isBeeOutput(r, o, reg)) { stats.beeOutputs += 1; continue; } // a Productive Bees bee type, not an item
      if (form === 'object') findings.push(finding('output-unregistered', r.id, o, `${r.type}: output stack names an unregistered item`));
      else if (!reg.entities.has(o) && !reg.blocks.has(o)) findings.push(finding('output-unrecognized', r.id, o, `${r.type}: bare output id is no registered item, block, fluid or entity (may be a mod-specific id)`, 'info'));
    }
    if (!outs.size && !r.special) stats.unsupportedOutputs += 1;
  }
  return { findings, stats };
}

// Fallbacks: for each tag some raw recipe uses as a positive `tag_empty` condition, the outputs that recipe
// makes instead (Extreme Reactors' `_alt` iron-block casing for an empty forge:ingots/steel). Map<tag, Set<output>>.
function fallbackTags(resources) {
  const tags = new Map();
  const walk = (c, outputs) => {
    if (!c || typeof c !== 'object') return;
    const t = String(c.type || '').replace(/^forge:/, '');
    if (t === 'tag_empty') { if (!tags.has(c.tag)) tags.set(c.tag, new Set()); outputs.forEach((o) => tags.get(c.tag).add(o)); }
    else if (t === 'and' || t === 'or') (c.values || []).forEach((v) => walk(v, outputs));
  };
  for (const raw of Object.values(resources.recipes || {})) {
    (raw.conditions || []).forEach((c) => walk(c, raw.outputs || []));
    for (const b of raw.branches || []) (b.conditions || []).forEach((c) => walk(c, b.outputs || []));
  }
  return tags;
}

// Raw recipes that are absent from the live RecipeManager, each classified by cause. A recipe disabled by an
// empty tag fails only when the pack ships a fallback for that tag (the fallback is then what players get);
// otherwise it is ordinary optional compatibility (AE2's matter-cannon ammo for metals the pack lacks) and info.
function reconcile(recipes, resources, state, { deliberate = new Set(), parseErrors = new Map() }) {
  const findings = [];
  const stats = { raw: 0, conditionalOff: 0, optionalCompat: 0, gatedOptional: 0, deliberate: 0, parseErrors: 0, unexplained: 0, malformed: 0 };
  const live = new Set(recipes.map((r) => r.id));
  const fallbacks = fallbackTags(resources);
  // Fails only when the gated recipe and the fallback for its empty tag make the same item.
  const gatedFinding = (code, id, t, msg, outputs = []) => {
    const fb = fallbacks.get(t);
    if (fb && outputs.some((o) => fb.has(o))) findings.push(finding(code === 'branch' ? 'branch-fallback-active' : 'recipe-fallback-active', id, `#${t}`, `${msg}; the pack's fallback recipe for an empty #${t} is active instead`));
    else { stats.gatedOptional += 1; findings.push(finding('recipe-gated-by-empty-tag', id, `#${t}`, msg, 'info')); }
  };
  for (const [id, raw] of Object.entries(resources.recipes || {})) {
    stats.raw += 1;
    const branches = raw.branches || (raw.conditions ? [{ conditions: raw.conditions }] : null);
    if (branches) {
      const evals = branches.map((b) => evaluateAll(b.conditions, state));
      const gated = evals.flatMap((e) => (e.value === false ? e.emptyTags : []));
      if (live.has(id)) { // loaded, but a preferred branch may have been skipped because a tag is empty
        const firstTrue = evals.findIndex((e) => e.value === true);
        evals.slice(0, firstTrue < 0 ? evals.length : firstTrue).flatMap((e) => (e.value === false ? e.emptyTags : []))
          .forEach((t) => gatedFinding('branch', id, t, `a preferred conditional branch is disabled because #${t} is empty`, branches.flatMap((b) => b.outputs || [])));
        continue;
      }
      if (evals.some((e) => e.value === true) && !deliberate.has(id)) {
        findings.push(finding(parseErrors.has(id) ? 'recipe-parse-error' : 'recipe-missing', id, null, parseErrors.get(id) || 'conditions pass but the recipe is not loaded'));
        continue;
      }
      if (gated.length) { [...new Set(gated)].forEach((t) => gatedFinding('recipe', id, t, `disabled because #${t} is empty`, raw.outputs || branches.flatMap((b) => b.outputs || []))); continue; }
      if (evals.some((e) => e.absentMod)) stats.optionalCompat += 1;
      else stats.conditionalOff += 1;
      continue;
    }
    if (live.has(id)) continue;
    if (deliberate.has(id)) { stats.deliberate += 1; continue; }
    if (parseErrors.has(id)) {
      stats.parseErrors += 1;
      const msg = parseErrors.get(id);
      const absent = /Unknown (?:item|recipe serializer|recipe type)[^']*'([a-z0-9_.-]+):/i.exec(msg) || /([a-z0-9_.-]+):[a-z0-9_/.-]+/.exec(msg);
      if (absent && !state.mods.has(absent[1])) findings.push(finding('recipe-optional-compat', id, absent[1], msg.slice(0, 200), 'info'));
      else findings.push(finding('recipe-parse-error', id, null, msg.slice(0, 200)));
      continue;
    }
    stats.unexplained += 1;
    findings.push(finding('recipe-not-loaded', id, raw.type || null, 'present in data but not loaded (KubeJS removal or silent serializer skip)', 'info'));
  }
  for (const m of resources.malformed || []) {
    if (m.kind !== 'recipes') continue;
    stats.malformed += 1;
    findings.push(finding('recipe-malformed-json', m.id, m.source, m.error));
  }
  return { findings, stats };
}

// Entry point. snap: { recipes, registries, tagMap }. resources: raw evidence. opts: { deliberate, parseErrors }.
function checkRecipes(snap, resources, opts = {}) {
  const reg = snap.registries;
  const a = checkLive(snap.recipes, reg, snap.itemTags);
  const b = reconcile(snap.recipes, resources, { mods: reg.mods, items: reg.items, itemTags: snap.itemTags }, opts);
  const findings = [...a.findings, ...b.findings];
  return { state: findings.some((f) => f.severity === 'fail') ? 'findings' : 'passed', findings, stats: { ...a.stats, ...b.stats } };
}

module.exports = { checkRecipes, ingredientRefs, declaredOutputs, declaredOutputRefs, checkLive, reconcile, fallbackTags };
