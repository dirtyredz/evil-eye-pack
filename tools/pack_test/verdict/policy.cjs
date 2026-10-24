'use strict';
// Check configuration with provenance: the tool's own data files (data/*.json) and the acquisition
// exclusion policy compiled from policy.json plus the pack's curated lists. Every exclusion keeps its reason.
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '../data');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

// Test data shipped with the tool (policy, fixtures, machine expectations, baseline).
function loadToolData(dataDir = DATA) {
  return {
    policy: readJson(path.join(dataDir, 'policy.json')),
    crafts: readJson(path.join(dataDir, 'crafts.json')),
    machines: readJson(path.join(dataDir, 'machines.json')),
    baseline: readJson(path.join(dataDir, 'baseline.json')),
    hiddenReasons: readJson(path.join(__dirname, '../../dedup/hidden_reasons.json')).reasons,
    allowed: readJson(path.join(__dirname, '../../dedup/allowed_groups.json')),
    knownNoise: readJson(path.join(__dirname, '../../server_smoke/known_noise.json'))
  };
}

// The pack files the analysis reads, as paths inside the staged server: the two dedup files plus every
// curated list policy.json names (all under config/emi-curation/). Evidence copies them by basename.
const DEDUP_CONFIG = ['kubejs/config/dedup.json', 'kubejs/config/dedup_sources.json'];
const packConfigFiles = (policyJson) => [...DEDUP_CONFIG, ...(policyJson.curatedLists || []).map((f) => `config/emi-curation/${f}`)];

// Builds the exclusion policy from policy.json and the curated lists. Each exclusion keeps its reason.
function compilePolicy(policyJson, { dedup, curated, hiddenReasons }) {
  const ids = {};
  for (const [id, reason] of Object.entries(policyJson.exclude.ids || {})) ids[id] = reason;
  for (const id of Object.keys(dedup.replacements)) ids[id] = ids[id] || `retired duplicate (dedup.json replacement -> ${dedup.replacements[id]})`;
  for (const id of dedup.disabled) ids[id] = ids[id] || 'disabled by dedup.json';
  for (const id of dedup.hiddenOnly) {
    const reason = hiddenReasons[id];
    if (!reason || !reason.class || !reason.evidence) throw new Error(`hidden_reasons.json: missing class/evidence for ${id}`);
    ids[id] = `hidden_reasons.json: ${reason.class}: ${reason.evidence}`;
  }
  for (const list of curated) for (const id of list.items) ids[id] = ids[id] || `${list.group}: ${list.description}`;
  return { exclude: { ids, patterns: policyJson.exclude.patterns || [] } };
}

module.exports = { loadToolData, compilePolicy, packConfigFiles, DATA };
