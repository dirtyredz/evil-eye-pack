'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { cost, classify } = require('./model.cjs');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const seconds = ms => ms === null ? 'not measured' : (ms / 1000).toFixed(3) + ' s';
function render(data, overrides = {}) {
  const { nodes, groups, shared, timing, registries, boot } = data;
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const users = new Set(nodes.flatMap(n => n.dependencies));
  const names = new Map(groups.map(g => [g.key, g.name]));
  const modRow = (m, n) => {
    const c = classify(m, n, users.has(n.key), registries, overrides);
    const t = timing.mods[m.id];
    return `<div class="mod"><div><strong>${esc(m.name)}</strong> <code>${esc(m.id)}</code> <span class="tag" title="${esc(c.evidence)}">${esc(c.kind)}</span></div>
<span class="time" title="${esc(t ? JSON.stringify(t.phases) : 'No paired Forge TRACE intervals')}">${n.side === 'client' ? 'not measured (client)' : seconds(t?.ms ?? null)}</span>
<p>${esc(c.description)}</p><small>${esc(c.evidence)}${c.counts ? ' · items / blocks / entities: ' + c.counts.join(' / ') : ''}</small></div>`;
  };
  const jar = (n, exclusive = false) => `<section class="jar"><div class="jar-title">${esc(n.name)} ${n.embedded ? '<span class="tag">embedded; cannot remove separately</span>' : ''}
${exclusive && n.mods.some(m => classify(m, n, true, registries, overrides).kind === 'library/API') ? '<span class="candidate">single top user</span>' : ''}</div>
${n.mods.map(m => modRow(m, n)).join('') || '<p>No Forge metadata; ' + esc(n.name) + '. <span class="tag">utility (unclassified)</span> ' + (n.side === 'client' ? 'not measured (client)' : 'not measured') + '</p>'}
<small>Jar: ${esc(n.key)}${n.providers?.length ? ' · embedded providers: ' + esc(n.providers.join(', ')) + '; Forge version selection determines runtime copy' : ''}${n.bundled.length ? ' · bundled archives: ' + esc(n.bundled.join(', ')) : ''}${n.optional?.length ? ' · optional links (not removal edges): ' + esc([...new Set(n.optional)].join(', ')) : ''}</small></section>`;
  const ranked = groups.map(g => ({ ...g, cost: cost([...g.tops, ...g.exclusive], timing) })).sort((a, b) => (b.cost.ms ?? -1) - (a.cost.ms ?? -1) || a.name.localeCompare(b.name));
  const heavy = new Set(ranked.filter(g => g.cost.ms > 0).slice(0, 10).map(g => g.key));
  const cards = ranked.map(g => {
    const kind = g.tops.flatMap(n => n.mods.map(m => classify(m, n, false, registries, overrides).kind)).sort()[0] || 'utility';
    return `<details class="group" data-name="${esc(g.name.toLowerCase())}" data-cost="${g.cost.ms ?? -1}" data-kind="${esc(kind)}">
<summary><span>${esc(g.name)} ${heavy.has(g.key) ? '<span class="candidate">heavy measured group</span>' : ''}</span><span class="time">${seconds(g.cost.ms)} <small>${g.cost.measured}/${g.cost.expected} server mod IDs measured</small></span></summary>
<p class="hint">${g.cycle ? 'Dependency cycle: these jars must be considered together. ' : ''}Top + ${g.exclusive.length} exclusive dependencies. Dependencies may be content mods, not just libraries.</p>
${g.tops.map(n => jar(n)).join('')}${g.exclusive.length ? '<div class="nested"><h3>Exclusive dependencies</h3>' + g.exclusive.map(n => jar(n, true)).join('') + '</div>' : ''}
${g.shared.length ? '<p>Shared dependencies stay: ' + g.shared.map(k => esc(byKey.get(k).name)).join(', ') + '</p>' : ''}</details>`;
  }).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Evil Eye · Mod map</title><style>${fs.readFileSync(path.join(__dirname, 'page.css'), 'utf8')}</style>
<header><p class="eyebrow">EVIL EYE / PACK WORKBENCH</p><h1>What belongs together?</h1><p>Explore removal groups, shared dependencies, and measured server startup work.</p></header>
<main><div class="stats"><div><strong>${nodes.filter(n => !n.embedded).length}</strong> installed jars</div><div><strong>${groups.length}</strong> top groups</div><div><strong>${shared.length}</strong> shared units</div><div><strong>${boot.wallSeconds.toFixed(2)} s</strong> process start → Done</div></div>
<aside><strong>Timing is a partial measurement, not predicted savings.</strong> Paired Forge TRACE intervals cover constructors, automatic subscribers and synchronous mod event handlers. Workers overlap; group totals sum elapsed intervals and can exceed wall time. Deferred jobs, discovery, mixins, resources and world loading are not fully attributed. Millisecond precision; one instrumented server boot. Client costs are unmeasured. Heavy means the ten largest measured groups, not necessarily safe removals.</aside>
<p class="hint">Mandatory dependency graph only; optional integrations, scripts, recipes and existing-world compatibility need separate review. Shared content (such as Create) is shown with shared libraries. Embedded jars stay inside their providers; this is not a deletion script.</p>
<div class="controls"><label>Filter <input id="filter" type="search" placeholder="Name, mod ID, description or kind"></label><label>Sort <select id="sort"><option value="cost">Measured group time</option><option value="name">Name</option><option value="kind">Kind</option></select></label><button id="expand">Expand all</button><button id="collapse">Collapse all</button><span id="count"></span></div>
<h2>Top groups <small>Remove a top; review its exclusive dependencies</small></h2><div id="groups">${cards}</div>
<h2>Shared dependencies <small>Keep until the last user goes</small></h2><div id="shared">${shared.map(c => `<details class="shared"><summary>${esc(c.nodes.map(n => n.name).join(' + '))}<span class="time">${seconds(cost(c.nodes, timing).ms)}</span></summary><p>Users: ${esc(c.users.map(k => names.get(k)).join(', '))}</p>${c.nodes.map(n => jar(n)).join('')}</details>`).join('')}</div>
<details><summary>Provenance and caveats (${data.warnings.length + timing.warnings.length})</summary><pre>${esc(JSON.stringify({ created: data.created, evidence: data.evidence, input: data.identity, boot, pins: data.pins, warnings: [...data.warnings, ...timing.warnings] }, null, 2))}</pre></details>
</main><footer>Offline snapshot · ${esc(data.created)} · ${esc(data.identity.commit)}</footer>
<script>${fs.readFileSync(path.join(__dirname, 'page.js'), 'utf8')}</script></html>`;
}
module.exports = { render, esc };
