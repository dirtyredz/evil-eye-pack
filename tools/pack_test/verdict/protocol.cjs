'use strict';
// The probe <-> runner contract. The probe writes one payload file per section, then manifest.json last.
// A payload is { schema, token, section, count, data }; the manifest is
// { schema, token, finishedAt, sections: [{ name, file, count, ok, error?, ms }] }.
// Nothing here trusts the probe: a missing, stale, partial or failed section can never become a pass.
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 1;
const SECTIONS = ['registries', 'tags', 'recipes', 'loot', 'crafting'];

function readJson(file) {
  try { return { json: JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch (e) { return { error: e.code === 'ENOENT' ? 'missing' : `unreadable: ${e.message}` }; }
}

// errors: manifest-level problems. sections: name -> { ok, error? } for every expected section.
function validateManifest(manifest, { token, expected = SECTIONS }) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { errors: ['manifest is not an object'], sections: {} };
  if (manifest.schema !== SCHEMA) errors.push(`unsupported manifest schema ${manifest.schema}`);
  if (manifest.token !== token) errors.push(`manifest token ${manifest.token} does not match this run (${token})`);
  const list = Array.isArray(manifest.sections) ? manifest.sections : [];
  const names = list.map((s) => s.name);
  for (const n of new Set(names.filter((n, i) => names.indexOf(n) !== i))) errors.push(`duplicate section ${n}`);
  const sections = {};
  for (const name of expected) {
    const s = list.find((x) => x.name === name);
    if (!s) sections[name] = { ok: false, error: 'section missing from manifest' };
    else if (!s.ok) sections[name] = { ok: false, error: s.error || 'probe reported failure' };
    else sections[name] = { ok: true, count: s.count, ms: s.ms, file: s.file };
  }
  return { errors, sections };
}

// Loads and validates every payload the manifest claims. Returns { manifestErrors, sections: name -> {ok, data|error} }.
function loadRun(outDir, { token, expected = SECTIONS }) {
  const m = readJson(path.join(outDir, 'manifest.json'));
  if (m.error) return { manifestErrors: [`manifest ${m.error}`], sections: Object.fromEntries(expected.map((n) => [n, { ok: false, error: 'no manifest' }])) };
  const v = validateManifest(m.json, { token, expected });
  const sections = {};
  for (const [name, s] of Object.entries(v.sections)) {
    if (!s.ok) { sections[name] = s; continue; }
    const p = readJson(path.join(outDir, s.file || `${name}.json`));
    if (p.error) sections[name] = { ok: false, error: `payload ${p.error}` };
    else sections[name] = checkPayload(p.json, name, token, s.count);
  }
  return { manifestErrors: v.errors, sections, manifest: m.json };
}

function checkPayload(p, name, token, count) {
  if (!p || p.schema !== SCHEMA) return { ok: false, error: `payload schema ${p && p.schema}` };
  if (p.token !== token) return { ok: false, error: 'stale payload (token mismatch)' };
  if (p.section !== name) return { ok: false, error: `payload is section ${p.section}` };
  if (count !== undefined && p.count !== count) return { ok: false, error: `payload count ${p.count} != manifest ${count}` };
  return { ok: true, data: p.data, count: p.count };
}

// True once a manifest with this run's token exists and parses (used as the boot completion condition).
function manifestReady(outDir, token) {
  const m = readJson(path.join(outDir, 'manifest.json'));
  return !m.error && m.json && m.json.token === token;
}

module.exports = { SCHEMA, SECTIONS, validateManifest, loadRun, checkPayload, manifestReady };
