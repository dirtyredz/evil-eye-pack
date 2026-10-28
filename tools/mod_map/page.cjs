'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { cost, classify } = require('./model.cjs');
const { categorize } = require('./categories.cjs');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const seconds = ms => ms === null ? 'not measured' : (ms / 1000).toFixed(3) + ' s';
function shortDescription(value, limit = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] || text;
  return sentence.length <= limit ? sentence : sentence.slice(0, limit - 1).trimEnd() + '…';
}

function render(data, overrides = {}) {
  const { nodes, families, libraryFamilies, unusedLibraries, memberships, classifications, timing, registries, boot } = data;
  const categories = data.categories || categorize(data, require('./categories.json'), nodes, timing, cost);
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const dependedOn = new Set(nodes.flatMap(n => n.dependencies));
  const familyNames = new Map(families.map(f => [f.key, f.name]));
  const isLibrary = n => classifications.get(n.key)?.every(c => c.kind === 'library/API');
  const directUsers = n => nodes.filter(user => user.dependencies.includes(n.key));
  const dependencyBadges = (n, fix) => {
    const users = directUsers(n);
    const useBadge = users.length
      ? `<span class="tag use" title="Used by: ${esc(users.map(user => user.name).join(', '))}">used by ${users.length}</span>`
      : fix
        ? `<span class="tag fix" title="${esc(fix)}">pack-wide fix</span>`
        : '<span class="tag idle">nothing depends on this</span>';
    const needs = n.dependencies.map(key => byKey.get(key)?.name || key);
    const needsBadge = needs.length ? `<span class="tag needs" title="Mandatory dependencies: ${esc(needs.join(', '))}">needs: ${esc(needs.join(', '))}</span>` : '';
    return useBadge + ' ' + needsBadge;
  };
  const modRow = (m, n) => {
    const c = classify(m, n, dependedOn.has(n.key), registries, overrides), t = timing.mods[m.id];
    const description = shortDescription(m.description);
    const descriptionText = description || 'No description in mods.toml.';
    return `<div class="mod"><div class="mod-main"><strong>${esc(m.name)}</strong> <code>${esc(m.id)}</code> <span class="tag" title="${esc(c.evidence)}">${esc(c.kind)}</span> ${dependencyBadges(n, overrides[m.id]?.packWideFix)} <span class="description${description ? '' : ' missing'}" title="${esc(descriptionText)}">${esc(descriptionText)}</span></div><span class="time" title="${esc(t ? JSON.stringify(t.phases) : 'No paired Forge TRACE intervals')}">${n.side === 'client' ? 'not measured (client)' : seconds(t?.ms ?? null)}</span></div>`;
  };
  const unknownRow = n => `<div class="mod"><div class="mod-main"><strong>${esc(n.name)}</strong> <span class="tag">utility (unclassified)</span> ${dependencyBadges(n)} <span class="description missing" title="No Forge mods.toml description.">No Forge mods.toml description.</span></div><span class="time">${n.side === 'client' ? 'not measured (client)' : 'not measured'}</span></div>`;
  const jar = (n, annotation = '') => `<section class="jar"><div class="jar-title">${esc(n.name)} ${annotation}${n.embedded ? '<span class="tag">bundled, can\'t remove separately</span>' : ''}</div>${n.mods.map(m => modRow(m, n)).join('') || unknownRow(n)}<small>Jar: ${esc(n.key)}${n.providers?.length ? ' · bundled with: ' + esc(n.providers.join(', ')) : ''}${n.bundled.length ? ' · bundled archives: ' + esc(n.bundled.join(', ')) : ''}${n.optional?.length ? ' · optional links (not family edges): ' + esc([...new Set(n.optional)].join(', ')) : ''}</small></section>`;
  const tree = family => {
    const rootKeys = new Set(family.roots.map(n => n.key)), libraryKeys = new Set(family.libraries.map(n => n.key));
    const children = new Map(family.members.map(n => [n.key, []]));
    for (const n of family.members.filter(n => !rootKeys.has(n.key))) {
      const parent = n.dependencies.map(key => byKey.get(key)).find(dep => dep && children.has(dep.key));
      if (parent) children.get(parent.key).push(n);
    }
    const draw = (n, seen = new Set()) => {
      if (seen.has(n.key)) return '';
      const next = new Set(seen); next.add(n.key);
      const contentOthers = [...(memberships.get(n.key) || [])].filter(id => id !== family.key).map(id => familyNames.get(id));
      const libraryOthers = [...(libraryFamilies.get(n.key) || [])].filter(id => id !== family.key).map(id => familyNames.get(id));
      const others = contentOthers.length ? contentOthers : libraryOthers;
      const annotation = others.length ? `<span class="candidate">shared ×${others.length + 1} · also used by: ${esc(others.join(', '))}</span>` : '';
      const contentChildren = children.get(n.key) || [];
      const libraryChildren = n.dependencies.filter(key => libraryKeys.has(key)).map(key => byKey.get(key));
      const nested = [...contentChildren, ...libraryChildren].sort((a, b) => a.name.localeCompare(b.name)).map(child => draw(child, next)).join('');
      return `<div class="branch">${jar(n, annotation)}${nested ? `<div class="nested">${nested}</div>` : ''}</div>`;
    };
    return family.roots.map(n => draw(n)).join('');
  };

  const ranked = families.map(f => ({ ...f, familyCost: cost([...f.members, ...f.libraries], timing) }))
    .sort((a, b) => (b.familyCost.ms ?? -1) - (a.familyCost.ms ?? -1) || a.name.localeCompare(b.name));
  const rankedByKey = new Map(ranked.map(family => [family.key, family]));
  const heavy = new Set(ranked.filter(f => f.familyCost.ms > 0).slice(0, 10).map(f => f.key));
  const familyCard = source => {
    const f = rankedByKey.get(source.key);
    return `<details class="group entry" data-name="${esc(f.name.toLowerCase())}" data-cost="${f.familyCost.ms ?? -1}" data-kind="family"><summary><span>${esc(f.name)} ${heavy.has(f.key) ? '<span class="candidate">heavy measured family</span>' : ''}</span><span class="time">${seconds(f.familyCost.ms)} <small>${f.familyCost.measured}/${f.familyCost.expected} measured</small></span></summary><p class="hint">${f.members.length} content ${f.members.length === 1 ? 'mod' : 'mods'} · ${f.libraries.length} mandatory ${f.libraries.length === 1 ? 'library' : 'libraries'}. Shared entries count in every family shown here.</p>${tree(f)}</details>`;
  };
  const standaloneCard = n => {
    const libraries = n.dependencies.map(key => byKey.get(key)).filter(dep => dep && isLibrary(dep));
    const nested = libraries.map(lib => jar(lib, directUsers(lib).length > 1 ? `<span class="candidate">shared ×${directUsers(lib).length}</span>` : '')).join('');
    const standaloneCost = cost([n, ...libraries], timing);
    return `<details class="shared entry" data-name="${esc(n.name.toLowerCase())}" data-cost="${standaloneCost.ms ?? -1}" data-kind="standalone"><summary>${esc(n.name)}<span class="time">${seconds(standaloneCost.ms)}</span></summary>${jar(n)}${nested ? `<div class="nested">${nested}</div>` : ''}</details>`;
  };
  const categoryCards = categories.map(category => {
    const entries = category.entries.map(entry => entry.type === 'family' ? familyCard(entry.value) : standaloneCard(entry.value)).join('');
    const unmapped = category.unmapped.length ? ` <span class="candidate">${category.unmapped.length} unmapped</span>` : '';
    return `<details class="category" data-name="${esc(category.name.toLowerCase())}"><summary><span>${esc(category.name)}${unmapped}</span><span class="time">${seconds(category.categoryCost.ms)} <small>${category.memberCount} ${category.memberCount === 1 ? 'member' : 'members'} · ${category.categoryCost.measured}/${category.categoryCost.expected} measured</small></span></summary><div class="category-body">${entries || '<p class="hint">No mapped mods in this snapshot.</p>'}</div></details>`;
  }).join('');
  const uniqueTotal = cost(nodes, timing);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Evil Eye · Mod map</title><style>${fs.readFileSync(path.join(__dirname, 'page.css'), 'utf8')}</style><header><p class="eyebrow">EVIL EYE / PACK WORKBENCH</p><h1>What belongs together?</h1><p>Explore mod categories, families, shared add-ons and measured server startup work.</p></header><main><div class="stats"><div><strong>${nodes.filter(n => !n.embedded).length}</strong> installed jars</div><div><strong>${categories.length}</strong> categories</div><div><strong>${families.length}</strong> families</div><div><strong>${seconds(uniqueTotal.ms)}</strong> unique attributed load</div></div><aside><strong>Timing is a partial measurement, not predicted savings.</strong> Paired Forge TRACE intervals cover constructors, automatic subscribers and synchronous mod event handlers. Workers overlap; category and family totals sum elapsed intervals and can exceed wall time. Deferred jobs, discovery, mixins, resources and world loading are not fully attributed. One instrumented server boot (${boot.wallSeconds.toFixed(2)} s process start → Done). Client costs are unmeasured.</aside><p class="hint"><strong>How totals work:</strong> categories count each member and library once within that category. Shared add-ons and libraries appear in every family that mandatorily uses them, and their time is included in each applicable family total. The page-wide unique attributed load counts every mod ID once. Optional dependencies never create family membership.</p><div class="controls"><label>Filter <input id="filter" type="search" placeholder="Name, mod ID, description or kind"></label><label>Sort within categories <select id="sort"><option value="cost">Measured time</option><option value="name">Name</option><option value="kind">Family / standalone</option></select></label><button id="expand">Expand all</button><button id="collapse">Collapse all</button><span id="count"></span></div><h2>Categories <small>All sections start collapsed; libraries stay beneath their users</small></h2><div id="categories">${categoryCards}</div>${unusedLibraries.length ? `<details class="unused shared"><summary>Unused libraries <span class="candidate">free trims · ${unusedLibraries.length}</span></summary>${unusedLibraries.map(n => jar(n, '<span class="candidate">unused library</span>')).join('')}</details>` : ''}<details><summary>Provenance and caveats (${data.warnings.length + timing.warnings.length})</summary><pre>${esc(JSON.stringify({ created: data.created, evidence: data.evidence, input: data.identity, boot, pins: data.pins, warnings: [...data.warnings, ...timing.warnings] }, null, 2))}</pre></details></main><footer>Offline snapshot · ${esc(data.created)} · ${esc(data.identity.commit)}</footer><script>${fs.readFileSync(path.join(__dirname, 'page.js'), 'utf8')}</script></html>`;
}
module.exports = { render, esc, shortDescription };
