'use strict';
// Log evidence: the existing smoke grouping (unchanged), plus per-resource load failures pulled out of
// latest.log and KubeJS's server.log so they keep their own identity (broad noise rules cannot hide them).
const { analyze } = require('../../server_smoke/log_report.cjs');

const TAG_RE = /Couldn't load tag (\S+) as it is missing following references: (.*)$/;
const LOOT_RE = /Couldn't parse element loot_tables:(\S+)/;
const DATA_RE = /Couldn't parse data file (\S+) from (\S+)/;
const KUBE_FAIL_RE = /Error parsing recipe ([a-z0-9_.-]+:[a-z0-9_/.-]+)\[([^\]]+)\]: .*\}: (.*)$/;
const KUBE_FALLBACK_RE = /Failed to parse recipe '([a-z0-9_.-]+:[a-z0-9_/.-]+)\[[^\]]+\]'! Falling back to vanilla: (.*)$/;
const VANILLA_RECIPE_RE = /Parsing error loading recipe (\S+)/;
const KUBE_LEVEL_RE = /^\[[^\]]*\] \[(ERROR|WARN)\] (.*)$/;

// Returns { tagFailures: [{tag, refs}], lootFailures: Map<id,msg>, dataFailures: [{id, file}],
//           recipeFailures: Map<id,msg>, kubeErrors: [line] }.
function resourceFailures(latest, kube) {
  const out = { tagFailures: [], lootFailures: new Map(), dataFailures: [], recipeFailures: new Map(), kubeErrors: [] };
  const lines = latest.split(/\r?\n/);
  lines.forEach((l, i) => {
    let m;
    if ((m = TAG_RE.exec(l))) out.tagFailures.push({ tag: m[1], refs: m[2].split(/,\s*(?![^(]*\))/).map((s) => s.trim()).filter(Boolean) });
    else if ((m = LOOT_RE.exec(l))) out.lootFailures.set(m[1], (lines[i + 1] || '').replace(/^[\w.$]+Exception: /, '').trim());
    else if ((m = DATA_RE.exec(l))) out.dataFailures.push({ id: m[1], file: m[2] });
    else if ((m = VANILLA_RECIPE_RE.exec(l))) out.recipeFailures.set(m[1], (lines[i + 1] || '').trim());
  });
  for (const l of kube.split(/\r?\n/)) {
    let m;
    if ((m = KUBE_FAIL_RE.exec(l))) out.recipeFailures.set(m[1], m[3].trim());
    else if ((m = KUBE_FALLBACK_RE.exec(l))) { if (!out.recipeFailures.has(m[1])) out.recipeFailures.set(m[1], `fallback: ${m[2].trim()}`); }
    else if ((m = KUBE_LEVEL_RE.exec(l)) && m[1] === 'ERROR') out.kubeErrors.push(m[2].slice(0, 300));
  }
  return out;
}

const { makeFinding, sectionResult } = require('../verdict/finding.cjs');

const finding = makeFinding('logs');

// mods: Set of loaded mod ids, to tell optional-compat failures (naming absent mods) from real ones.
function checkLogs(latest, kube, knownNoise, mods) {
  const rep = analyze(latest, knownNoise);
  const rf = resourceFailures(latest, kube);
  const findings = [];
  const absentNs = (s) => [...s.matchAll(/#?([a-z0-9_.-]+):[a-z0-9_/.-]+/g)].map((m) => m[1]).filter((ns) => !mods.has(ns));
  for (const t of rf.tagFailures) {
    const refs = t.refs.map((r) => r.replace(/ \(from .*\)$/, ''));
    const optional = refs.every((r) => absentNs(r).length);
    findings.push(finding(optional ? 'tag-optional-compat' : 'tag-load-failed', `#${t.tag}`, refs.sort().join(','), `tag dropped: missing ${refs.join(', ')}`, optional ? 'info' : 'fail'));
  }
  for (const [id, msg] of rf.lootFailures) {
    const optional = absentNs(msg).length > 0;
    findings.push(finding(optional ? 'loot-optional-compat' : 'loot-parse-error', id, null, msg.slice(0, 200), optional ? 'info' : 'fail'));
  }
  for (const d of rf.dataFailures) findings.push(finding('data-parse-error', d.id, d.file, 'data file failed to parse'));
  const seen = new Set();
  for (const e of rf.kubeErrors) {
    const sig = e.replace(/\d+/g, '#').slice(0, 160);
    if (seen.has(sig)) continue;
    seen.add(sig);
    findings.push(finding('kubejs-error', sig, null, e));
  }
  const stats = { doneSeconds: rep.doneSeconds, knownNoise: rep.known.length, freshGroups: rep.fresh.length, tagFailures: rf.tagFailures.length, lootFailures: rf.lootFailures.size, recipeFailures: rf.recipeFailures.size };
  return sectionResult(findings, stats, { analysis: rep, recipeFailures: rf.recipeFailures, lootFailures: rf.lootFailures, droppedTags: new Set(rf.tagFailures.map((t) => t.tag)) });
}

module.exports = { checkLogs, resourceFailures };
