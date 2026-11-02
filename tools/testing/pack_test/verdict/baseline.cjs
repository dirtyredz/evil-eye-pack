'use strict';
// Pure baseline logic: stable finding identity, baseline validation and new/known/resolved comparison.
// A finding is { check, code, subject, ref?, severity: 'fail'|'info', message, evidence? }.
// Only 'fail' findings can be new; 'info' findings are reported but never fail a run.

const SCHEMA = 1;

// Identity uses check, code, subject and the relevant reference; never messages, counts, paths or times.
const findingKey = (f) => [f.check, f.code, f.subject, f.ref || ''].join('|');

function validateBaseline(b) {
  const errors = [];
  if (!b || b.schema !== SCHEMA) errors.push(`baseline schema must be ${SCHEMA}`);
  const seen = new Set();
  for (const e of (b && b.findings) || []) {
    if (!e.key || e.key.split('|').length !== 4) errors.push(`malformed finding key: ${JSON.stringify(e.key)}`);
    if (!e.reason || !String(e.reason).trim()) errors.push(`finding without a reason: ${e.key}`);
    if (seen.has(e.key)) errors.push(`duplicate finding key: ${e.key}`);
    seen.add(e.key);
  }
  const sigs = new Set();
  for (const s of (b && b.logSignatures) || []) {
    if (!s.signature) errors.push('log signature entry without a signature');
    if (!s.reason) errors.push(`log signature without a reason: ${s.signature}`);
    if (sigs.has(s.signature)) errors.push(`duplicate log signature: ${s.signature}`);
    sigs.add(s.signature);
  }
  return errors;
}

// completedChecks: checks whose section finished, so a missing finding there really is resolved.
function compareFindings(findings, baseline, completedChecks) {
  const accepted = new Map(((baseline && baseline.findings) || []).map((e) => [e.key, e]));
  const out = { new: [], known: [], resolved: [], info: [] };
  const present = new Set();
  for (const f of findings) {
    const key = findingKey(f);
    present.add(key);
    if (f.severity !== 'fail') out.info.push({ ...f, key });
    else if (accepted.has(key)) out.known.push({ ...f, key, reason: accepted.get(key).reason });
    else out.new.push({ ...f, key });
  }
  for (const [key, e] of accepted) {
    if (!present.has(key) && completedChecks.has(key.split('|')[0])) out.resolved.push({ key, reason: e.reason });
  }
  return out;
}

// fresh: log_report.analyze(...).fresh groups (known boot noise already removed).
function compareLogs(fresh, baseline) {
  const accepted = new Map(((baseline && baseline.logSignatures) || []).map((s) => [s.signature, s]));
  const seen = new Set(fresh.map((g) => g.signature));
  return {
    new: fresh.filter((g) => !accepted.has(g.signature)),
    known: fresh.filter((g) => accepted.has(g.signature)).map((g) => ({ ...g, reason: accepted.get(g.signature).reason })),
    resolved: [...accepted.values()].filter((s) => !seen.has(s.signature))
  };
}

// A candidate baseline for review: the current baseline plus every new finding, marked as needing a reason.
// It is written to the run folder only; nothing updates the committed baseline automatically.
function candidate(baseline, cmp, logCmp, runId) {
  const b = baseline || { schema: SCHEMA, findings: [], logSignatures: [] };
  return {
    schema: SCHEMA,
    findings: [...b.findings, ...cmp.new.map((f) => ({ key: f.key, reason: 'TODO: review before accepting', since: runId, message: f.message }))],
    logSignatures: [...(b.logSignatures || []), ...logCmp.new.map((g) => ({ signature: g.signature, reason: 'TODO: review before accepting', since: runId, sample: g.sample }))]
  };
}

module.exports = { SCHEMA, findingKey, validateBaseline, compareFindings, compareLogs, candidate };
