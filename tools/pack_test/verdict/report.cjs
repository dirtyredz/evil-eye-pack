'use strict';
// One report model -> report.json, summary.txt and the exit code.
// Exit codes: 0 complete run, no new failures; 1 new pack findings; 2 invalid/incomplete run or setup/cleanup failure.
const { compareFindings, compareLogs } = require('./baseline.cjs');

const EXIT = { OK: 0, NEW: 1, INVALID: 2 };
const STATES = ['passed', 'findings', 'incomplete', 'unsupported'];

// sections: name -> { state, findings: [...], stats, error? }. Returns the full model.
function buildReport({ run, boot, sections, logs, baseline, infraErrors = [] }) {
  for (const [name, s] of Object.entries(sections)) {
    if (!STATES.includes(s.state)) throw new Error(`section ${name} has invalid state ${s.state}`);
  }
  const findings = dedupe(Object.values(sections).flatMap((s) => s.findings || []));
  const completed = new Set(Object.entries(sections).filter(([, s]) => s.state === 'passed' || s.state === 'findings').map(([n]) => n));
  const cmp = compareFindings(findings, baseline, completed);
  const logCmp = logs ? compareLogs(logs.fresh, baseline) : { new: [], known: [], resolved: [] };
  const incomplete = Object.entries(sections).filter(([, s]) => s.state === 'incomplete').map(([n, s]) => `${n}: ${s.error || 'incomplete'}`);
  const problems = [...infraErrors, ...incomplete];
  let exit = EXIT.OK;
  if (problems.length) exit = EXIT.INVALID;
  else if (cmp.new.length || logCmp.new.length) exit = EXIT.NEW;
  return {
    schema: 1,
    verdict: { exit, label: exit === 0 ? 'PASS' : exit === 1 ? 'NEW FINDINGS' : 'INVALID RUN', problems },
    run,
    boot,
    sections: Object.fromEntries(Object.entries(sections).map(([n, s]) => [n, { state: s.state, error: s.error, stats: s.stats || {}, counts: countBy(s.findings || [], cmp) }])),
    findings: { new: cmp.new, known: cmp.known, resolved: cmp.resolved, info: cmp.info },
    logs: logs ? { doneSeconds: logs.doneSeconds, knownNoise: logs.known.length, new: logCmp.new, known: logCmp.known.map((g) => ({ signature: g.signature, count: g.count })), resolved: logCmp.resolved.map((s) => s.signature) } : null,
    _cmp: cmp,
    _logCmp: logCmp
  };
}

// One finding per identity (a log line repeated by a reload is still one problem).
function dedupe(findings) {
  const seen = new Set();
  return findings.filter((f) => { const k = [f.check, f.code, f.subject, f.ref || ''].join('|'); if (seen.has(k)) return false; seen.add(k); return true; });
}

function countBy(findings, cmp) {
  const keys = new Set(findings.map((f) => [f.check, f.code, f.subject, f.ref || ''].join('|')));
  const n = (list) => list.filter((f) => keys.has(f.key)).length;
  return { new: n(cmp.new), known: n(cmp.known), info: n(cmp.info) };
}

// The JSON written to report.json (internal comparison handles dropped).
function toJson(model) {
  const { _cmp, _logCmp, ...rest } = model;
  return rest;
}

const line = (f) => `  [${f.check}/${f.code}] ${f.subject}${f.ref ? ` -> ${f.ref}` : ''}${f.message ? `: ${f.message}` : ''}`;

function summarize(model, { maxList = 40 } = {}) {
  const r = model.run || {};
  const out = [];
  out.push(`mode: ${r.mode || r.target || '?'}  ${model.verdict.label} (exit ${model.verdict.exit})  commit=${r.commit || '?'}${r.dirty ? ' (dirty)' : ''}  seed=${r.seed || '?'}`);
  if (r.sharedAttempt) out.push(`note: ${r.sharedAttempt.text}`);
  if (model.boot) out.push(`boot: Done ${model.boot.wallSeconds ?? '-'} s, total ${Math.round(model.boot.totalWallSeconds || 0)} s, JVM CPU ${model.boot.cpuSeconds == null ? '?' : Math.round(model.boot.cpuSeconds)} s, probe ${model.boot.completed ? 'complete' : 'NOT complete'}`);
  if (r.timings) out.push(`timings (s): ${Object.entries(r.timings).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')}`);
  for (const p of model.verdict.problems) out.push(`INVALID: ${p}`);
  out.push('');
  out.push('section        state        new  known  info  stats');
  for (const [n, s] of Object.entries(model.sections)) {
    out.push(`${n.padEnd(14)} ${s.state.padEnd(12)} ${String(s.counts.new).padStart(3)}  ${String(s.counts.known).padStart(5)}  ${String(s.counts.info).padStart(4)}  ${Object.entries(s.stats).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  if (model.logs) out.push(`log groups     ${model.logs.new.length ? 'findings' : 'passed'}       ${String(model.logs.new.length).padStart(3)}  ${String(model.logs.known.length).padStart(5)}     -  knownNoise=${model.logs.knownNoise} resolved=${model.logs.resolved.length}`);
  const fresh = model.findings.new;
  if (fresh.length) {
    out.push('', `NEW findings (${fresh.length}):`);
    fresh.slice(0, maxList).forEach((f) => out.push(line(f)));
    if (fresh.length > maxList) out.push(`  ... ${fresh.length - maxList} more in report.json`);
  }
  if (model.logs && model.logs.new.length) {
    out.push('', `NEW log error groups (${model.logs.new.length}):`);
    model.logs.new.slice(0, 15).forEach((g) => out.push(`  x${g.count} ${g.signature.slice(0, 200)}`));
  }
  if (model.findings.resolved.length) {
    out.push('', `Resolved baseline entries (${model.findings.resolved.length}) - remove them from data/baseline.json:`);
    model.findings.resolved.slice(0, 20).forEach((f) => out.push(`  ${f.key}`));
  }
  return out.join('\n') + '\n';
}

module.exports = { EXIT, STATES, buildReport, toJson, summarize };
