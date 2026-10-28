'use strict';
// HTML fragment builders over the derived page view (view.cjs). Every value is escaped here.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const seconds = ms => ms === null ? 'not measured' : (ms / 1000).toFixed(3) + ' s';
const plural = (count, one, many) => count === 1 ? one : many;
function shortDescription(value, limit = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] || text;
  return sentence.length <= limit ? sentence : sentence.slice(0, limit - 1).trimEnd() + '…';
}

function dependencyBadges(jar, fix) {
  const useBadge = jar.users.length
    ? `<span class="tag use" title="Used by: ${esc(jar.users.join(', '))}">used by ${jar.users.length}</span>`
    : fix
      ? `<span class="tag fix" title="${esc(fix)}">pack-wide fix</span>`
      : '<span class="tag idle">nothing depends on this</span>';
  const needsBadge = jar.needs.length ? `<span class="tag needs" title="Mandatory dependencies: ${esc(jar.needs.join(', '))}">needs: ${esc(jar.needs.join(', '))}</span>` : '';
  return useBadge + ' ' + needsBadge;
}
function modRow({ mod, classification: c, timing: t }, jar) {
  const description = shortDescription(mod.description);
  const descriptionText = description || 'No description in mods.toml.';
  return `<div class="mod"><div class="mod-main"><strong>${esc(mod.name)}</strong> <code>${esc(mod.id)}</code> <span class="tag" title="${esc(c.evidence)}">${esc(c.kind)}</span> ${dependencyBadges(jar, c.packWideFix)} <span class="description${description ? '' : ' missing'}" title="${esc(descriptionText)}">${esc(descriptionText)}</span></div><span class="time" title="${esc(t ? JSON.stringify(t.phases) : 'No paired Forge TRACE intervals')}">${jar.node.side === 'client' ? 'not measured (client)' : seconds(t?.ms ?? null)}</span></div>`;
}
const unknownRow = jar => `<div class="mod"><div class="mod-main"><strong>${esc(jar.node.name)}</strong> <span class="tag">utility (unclassified)</span> ${dependencyBadges(jar)} <span class="description missing" title="No Forge mods.toml description.">No Forge mods.toml description.</span></div><span class="time">${jar.node.side === 'client' ? 'not measured (client)' : 'not measured'}</span></div>`;
function jarSection(jar, annotation = '') {
  const n = jar.node;
  return `<section class="jar"><div class="jar-title">${esc(n.name)} ${annotation}${n.embedded ? '<span class="tag">bundled, can\'t remove separately</span>' : ''}</div>${jar.rows.map(row => modRow(row, jar)).join('') || unknownRow(jar)}<small>Jar: ${esc(n.key)}${n.providers?.length ? ' · bundled with: ' + esc(n.providers.join(', ')) : ''}${n.bundled.length ? ' · bundled archives: ' + esc(n.bundled.join(', ')) : ''}${n.optional?.length ? ' · optional links (not family edges): ' + esc([...new Set(n.optional)].join(', ')) : ''}</small></section>`;
}
function branch(node) {
  const annotation = node.others.length ? `<span class="candidate">shared ×${node.others.length + 1} · also used by: ${esc(node.others.join(', '))}</span>` : '';
  const nested = node.children.map(branch).join('');
  return `<div class="branch">${jarSection(node.jar, annotation)}${nested ? `<div class="nested">${nested}</div>` : ''}</div>`;
}
function familyCard({ family: f, heavy, tree }) {
  return `<details class="group entry" data-name="${esc(f.name.toLowerCase())}" data-cost="${f.familyCost.ms ?? -1}" data-kind="family"><summary><span>${esc(f.name)} ${heavy ? '<span class="candidate">heavy measured family</span>' : ''}</span><span class="time">${seconds(f.familyCost.ms)} <small>${f.familyCost.measured}/${f.familyCost.expected} measured</small></span></summary><p class="hint">${f.members.length} content ${plural(f.members.length, 'mod', 'mods')} · ${f.libraries.length} mandatory ${plural(f.libraries.length, 'library', 'libraries')}. Shared entries count in every family shown here.</p>${tree.map(branch).join('')}</details>`;
}
function standaloneCard({ jar, cost, libraries }) {
  const nested = libraries.map(lib => jarSection(lib.jar, lib.shared > 1 ? `<span class="candidate">shared ×${lib.shared}</span>` : '')).join('');
  return `<details class="shared entry" data-name="${esc(jar.node.name.toLowerCase())}" data-cost="${cost.ms ?? -1}" data-kind="standalone"><summary>${esc(jar.node.name)}<span class="time">${seconds(cost.ms)}</span></summary>${jarSection(jar)}${nested ? `<div class="nested">${nested}</div>` : ''}</details>`;
}
function categoryCard(category) {
  const entries = category.entries.map(entry => entry.type === 'family' ? familyCard(entry) : standaloneCard(entry)).join('');
  const unmapped = category.unmapped ? ` <span class="candidate">${category.unmapped} unmapped</span>` : '';
  return `<details class="category" data-name="${esc(category.name.toLowerCase())}"><summary><span>${esc(category.name)}${unmapped}</span><span class="time">${seconds(category.cost.ms)} <small>${category.memberCount} ${plural(category.memberCount, 'member', 'members')} · ${category.cost.measured}/${category.cost.expected} measured</small></span></summary><div class="category-body">${entries || '<p class="hint">No mapped mods in this snapshot.</p>'}</div></details>`;
}
function unusedLibrariesSection(jars) {
  return jars.length ? `<details class="unused shared"><summary>Unused libraries <span class="candidate">free trims · ${jars.length}</span></summary>${jars.map(jar => jarSection(jar, '<span class="candidate">unused library</span>')).join('')}</details>` : '';
}
module.exports = { esc, seconds, shortDescription, categoryCard, unusedLibrariesSection };
