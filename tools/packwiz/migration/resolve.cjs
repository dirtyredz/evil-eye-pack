'use strict';
// Survey resolution: turns the source metafiles, the availability survey (bulk-results.json) and
// the reviewed dispositions into one selector per lock entry — which project and exact file each
// entry should become, or why it is deferred/dropped. Pure: platform data arrives through `lookup`.
const fs = require('node:fs');
const path = require('node:path');
const { readMetafileDownload, readMetafileName, readMetafileSide, readTable, readCurseForge } = require('../pack_index.cjs');
const { sourceMetafiles } = require('./manifest.cjs');

// The identity a source metafile pins today.
function oldIdentity(root, rel) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  const d = readMetafileDownload(text);
  const mr = readTable(text, '[update.modrinth]', ['mod-id', 'version']);
  const cf = readCurseForge(text);
  const id = { name: readMetafileName(text), filename: d.filename, side: readMetafileSide(text), hashFormat: d.hashFormat, hash: d.hash };
  if (mr && mr['mod-id']) return { ...id, source: 'modrinth', project: mr['mod-id'], version: mr.version, url: d.url };
  if (cf.project) return { ...id, source: 'curseforge', project: cf.project, file: cf.file };
  return { ...id, source: 'direct', url: d.url };
}

// The survey's selected exact NeoForge 1.21.1 file for a mod, as a selector.
function surveySelector(row) {
  if (!row || !row.available || !row.neoLatest) return null;
  if (row.source === 'modrinth') return { source: 'modrinth', project: row.sourceId, version: row.neoLatest.id };
  if (row.source === 'curseforge') return { source: 'curseforge', project: String(row.sourceId), file: String(row.neoLatest.id) };
  return null;
}

// Resource and shader packs were outside the survey: keep the pinned version when Modrinth tags it
// for the target, else take the newest release-channel version that is tagged for it.
function packSelector(old, versions, minecraft) {
  if (old.source !== 'modrinth') return null;
  const tagged = versions.filter(v => (v.game_versions || []).includes(minecraft));
  if (tagged.some(v => v.id === old.version)) return { action: 'retain', selector: { source: 'modrinth', project: old.project, version: old.version }, why: `pinned version is tagged ${minecraft}` };
  const pick = tagged.filter(v => v.version_type === 'release').sort((a, b) => (a.date_published < b.date_published ? 1 : -1))[0];
  return pick ? { action: 'repoint', selector: { source: 'modrinth', project: old.project, version: pick.id }, why: `pinned version is not tagged ${minecraft}; newest tagged release ${pick.version_number}` } : null;
}

// Returns [{ metafile, action, old, selector, targetMetafile, name, side, provisional, rationale }]
// plus additions. Throws when an entry cannot be resolved at all (never guesses).
async function planEntries({ root, survey, dispositions, minecraft, lookup }) {
  const rows = new Map(survey.map(r => [`mods/${r.metafile}`, r]));
  const decided = dispositions.entries || {};
  const provisional = new Set(dispositions.provisional || []);
  const out = [];
  for (const rel of sourceMetafiles(root)) {
    const old = oldIdentity(root, rel);
    const d = decided[rel];
    const base = { metafile: rel, old, provisional: provisional.has(rel) };
    if (d && ['defer', 'drop'].includes(d.action)) { out.push({ ...base, action: d.action, rationale: d.reason }); continue; }
    let action, selector, rationale;
    if (d) {
      action = d.action; selector = d.target; rationale = d.reason;
    } else if (rel.startsWith('mods/')) {
      selector = surveySelector(rows.get(rel));
      action = 'repoint';
      rationale = 'survey-selected exact NeoForge 1.21.1 file';
    } else {
      const r = packSelector(old, await lookup.modrinthVersions(old.project), minecraft);
      if (r) { action = r.action; selector = r.selector; rationale = r.why; }
    }
    if (!selector) throw new Error(`${rel}: no target and no disposition (add one to dispositions.json)`);
    out.push({ ...base, action, selector, targetMetafile: d?.metafile || rel, name: d?.name || old.name, side: d?.side || old.side, rationale });
  }
  for (const a of dispositions.additions || []) {
    out.push({ metafile: a.metafile, action: 'add', old: null, selector: a.target, targetMetafile: a.metafile, name: a.name, side: a.side, provisional: provisional.has(a.metafile), rationale: a.reason });
  }
  return out;
}

module.exports = { oldIdentity, surveySelector, packSelector, planEntries };
