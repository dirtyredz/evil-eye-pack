'use strict';
// Machine recipe types: runtime counts against configured floors, plus named recipe/tag assertions.
// config (data/machines.json): { types: { "<type>": { min, observed, mod } }, assertions: [...] }.
// Assertion kinds: tag-contains {tag,item} | recipe-loaded {id} | recipe-not-loaded {id} |
//                  recipe-uses-tag {id,tag} | recipe-output {id,item}.
const { ingredientRefs, declaredOutputs } = require('./recipes.cjs');

const finding = (code, subject, ref, message, severity = 'fail') => ({ check: 'machines', code, subject, ref, message, severity });

function typeCounts(recipes) {
  const counts = {};
  for (const r of recipes) counts[r.type] = (counts[r.type] || 0) + 1;
  return counts;
}

function assertion(a, byId, itemTags) {
  const r = a.id ? byId.get(a.id) : null;
  switch (a.kind) {
    case 'tag-contains': return (itemTags.get(a.tag) || []).includes(a.item) ? null : `#${a.tag} does not contain ${a.item}`;
    case 'recipe-loaded': return r ? null : 'recipe is not loaded';
    case 'recipe-not-loaded': return r ? 'recipe is loaded but should not be' : null;
    case 'recipe-uses-tag': {
      if (!r) return 'recipe is not loaded';
      return (r.ings || []).some((i) => { const x = ingredientRefs(i.j); return x && x.tags.includes(a.tag); }) ? null : `recipe does not use #${a.tag}`;
    }
    case 'recipe-output': {
      if (!r) return 'recipe is not loaded';
      return r.out === a.item || declaredOutputs(r.json).includes(a.item) ? null : `recipe does not output ${a.item}`;
    }
    default: return `unknown assertion kind ${a.kind}`;
  }
}

function checkMachines(recipes, itemTags, config) {
  const findings = [];
  const counts = typeCounts(recipes);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const stats = { types: Object.keys(config.types).length, assertions: config.assertions.length };
  for (const [type, t] of Object.entries(config.types)) {
    const n = counts[type] || 0;
    if (!n) findings.push(finding('type-missing', type, null, 'no loaded recipes of this type'));
    else if (n < t.min) findings.push(finding('type-below-floor', type, String(t.min), `${n} loaded recipes, floor ${t.min}`));
    else if (t.observed !== undefined && n !== t.observed) findings.push(finding('type-count-changed', type, null, `${n} loaded recipes (recorded ${t.observed})`, 'info'));
  }
  for (const a of config.assertions) {
    const err = assertion(a, byId, itemTags);
    if (err) findings.push(finding(`assert-${a.kind}`, a.id || `#${a.tag}`, a.item || a.tag || null, `${err}${a.why ? ` (${a.why})` : ''}`));
  }
  return { state: findings.some((f) => f.severity === 'fail') ? 'findings' : 'passed', findings, stats, counts };
}

module.exports = { checkMachines, typeCounts };
