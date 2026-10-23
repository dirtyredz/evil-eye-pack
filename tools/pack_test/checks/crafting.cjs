'use strict';
// Curated crafts: compares what the probe's stand-in player actually crafted with data/crafts.json.
// probe result: { name, ok, error?, recipe, result: {id, count, nbt?}, grid: [{slot, id, count}] (after the take) }.
// fixture: { name, recipe, grid: [9 ids or null], expect: { id, count, nbt? }, remainders?: [{slot, id, count}] }.

const finding = (code, subject, ref, message) => ({ check: 'crafting', code, subject, ref, message, severity: 'fail' });

function evaluateCraft(fx, got) {
  if (!got) return [finding('craft-not-run', fx.name, null, 'the probe returned no result for this fixture')];
  if (!got.ok) return [finding('craft-error', fx.name, fx.recipe, got.error || 'probe could not craft')];
  const out = [];
  if (got.recipe !== fx.recipe) out.push(finding('craft-wrong-recipe', fx.name, fx.recipe, `matched ${got.recipe || 'no recipe'}`));
  const r = got.result || {};
  if (r.id !== fx.expect.id || r.count !== fx.expect.count) out.push(finding('craft-wrong-output', fx.name, fx.expect.id, `got ${r.count || 0}x ${r.id || 'nothing'}, expected ${fx.expect.count}x ${fx.expect.id}`));
  if (fx.expect.nbt !== undefined && r.nbt !== fx.expect.nbt) out.push(finding('craft-wrong-nbt', fx.name, fx.expect.id, `nbt ${r.nbt || '{}'} != ${fx.expect.nbt}`));
  const left = (got.grid || []).map((s) => `${s.slot}:${s.id}x${s.count}`).sort();
  const want = (fx.remainders || []).map((s) => `${s.slot}:${s.id}x${s.count}`).sort();
  if (JSON.stringify(left) !== JSON.stringify(want)) out.push(finding('craft-inputs-not-consumed', fx.name, fx.recipe, `grid after crafting [${left.join(', ')}], expected [${want.join(', ')}]`));
  return out;
}

function checkCrafting(results, fixtures) {
  const byName = new Map((results || []).map((r) => [r.name, r]));
  const findings = fixtures.flatMap((fx) => evaluateCraft(fx, byName.get(fx.name)));
  return { state: findings.length ? 'findings' : 'passed', findings, stats: { crafts: fixtures.length, failed: new Set(findings.map((f) => f.subject)).size } };
}

module.exports = { checkCrafting, evaluateCraft };
