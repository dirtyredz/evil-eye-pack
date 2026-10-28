'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { familyModel } = require('../../model/families.cjs');
const { render } = require('../../page/document.cjs');
const { shortDescription } = require('../../page/html.cjs');
const overrides = require('../../model/overrides.json');
const { node, registries, pageData } = require('../fixtures.cjs');

test('family tree nests an add-on of an add-on under its immediate mandatory dependency', () => {
  const nodes = [node('base'), node('addon', ['base']), node('nested', ['addon'])];
  const regs = registries(['base', 'addon', 'nested']);
  const html = render(pageData(nodes, familyModel(nodes, regs), { registries: regs }));
  assert.ok(html.indexOf('base</strong>') < html.indexOf('addon</strong>'));
  assert.ok(html.indexOf('addon</strong>') < html.indexOf('nested</strong>'));
});
test('bridge add-on is visibly marked shared in both families', () => {
  const nodes = [node('ars'), node('ae2'), node('ars-addon', ['ars']), node('ae2-addon', ['ae2']), node('bridge', ['ars', 'ae2'])];
  const regs = registries(nodes.map(n => n.key));
  const html = render(pageData(nodes, familyModel(nodes, regs), { registries: regs }));
  assert.match(html, /shared ×2 · also used by: ae2/);
  assert.match(html, /shared ×2 · also used by: ars/);
});
test('shared library nests under every family user, counts in each total, and orphan is a compact trim row', () => {
  const nodes = [node('alpha'), node('alpha-addon', ['alpha', 'shared-lib']), node('alpha-second', ['alpha', 'shared-lib']), node('beta'), node('beta-addon', ['beta', 'shared-lib']), node('shared-lib'), node('orphan-lib')];
  const regs = registries(['alpha', 'alpha-addon', 'alpha-second', 'beta', 'beta-addon']);
  const model = familyModel(nodes, regs, {
    'shared-lib': { kind: 'library/API', reason: 'fixture library' },
    'orphan-lib': { kind: 'library/API', reason: 'fixture orphan' }
  });
  const timing = { mods: { alpha: { ms: 10 }, beta: { ms: 20 }, 'shared-lib': { ms: 50 } }, warnings: [] };
  const html = render(pageData(nodes, model, { timing, registries: regs }));
  assert.equal((html.match(/shared-lib<\/strong>/g) || []).length, 3);
  assert.equal((html.match(/shared ×2 · also used by:/g) || []).length, 3);
  assert.match(html, /alpha[\s\S]*0\.060 s/);
  assert.match(html, /beta[\s\S]*0\.070 s/);
  assert.doesNotMatch(html, /Shared libraries/);
  assert.match(html, /Unused libraries <span class="candidate">free trims · 1/);
});
test('HTML escapes metadata and embeds controls without network resources', () => {
  const n = node('evil'); n.name = '<script>alert(1)</script>'; n.mods[0].description = '</script><script>bad()</script>';
  const html = render(pageData([n], familyModel([n], {})));
  assert.ok(html.includes('&lt;script&gt;alert(1)'));
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=/i.test(html));
  assert.ok(html.includes('not measured'));
});
test('bundled jar libraries nest under both owners and cannot be shown as separate trims', () => {
  const skin = node('skinlayers3d', ['bundled:trender']); skin.name = '3D Skin Layers';
  const culling = node('entityculling', ['bundled:trender']); culling.name = 'Entity Culling';
  const trender = node('bundled:trender');
  trender.name = 'TRender'; trender.embedded = true; trender.providers = [skin.key, culling.key];
  trender.mods[0].id = 'trender'; trender.mods[0].name = 'TRender';
  const nodes = [skin, culling, trender];
  const regs = registries(['skinlayers3d', 'entityculling']);
  const html = render(pageData(nodes, familyModel(nodes, regs, overrides), { registries: regs }));
  assert.equal((html.match(/TRender<\/strong>/g) || []).length, 2);
  assert.equal((html.match(/bundled, can't remove separately/g) || []).length, 2);
});
test('compact rows show first-sentence descriptions and dependency or pack-wide badges', () => {
  assert.equal(shortDescription('First sentence. Second sentence is omitted.'), 'First sentence.');
  assert.equal(shortDescription('x'.repeat(130)).length, 120);
  const base = node('base'); base.name = 'Base';
  const user = node('user', ['base']); user.mods[0].description = 'First sentence. Second sentence.';
  const fix = node('fix'); fix.mods[0].id = 'attributefix';
  const nodes = [base, user, fix];
  const regs = registries(['base', 'user']);
  const html = render(pageData(nodes, familyModel(nodes, regs, overrides), { registries: regs }));
  assert.match(html, /used by 1/);
  assert.match(html, /needs: Base/);
  assert.match(html, /pack-wide fix/);
  assert.match(html, />First sentence\.<\/span>/);
  assert.doesNotMatch(html, /Second sentence/);
});
test('render is a view over finished data and never classifies or categorizes itself', () => {
  const n = node('a');
  const data = pageData([n], familyModel([n], {}));
  assert.throws(() => render({ ...data, categories: undefined }), /finished data/);
  assert.throws(() => render({ ...data, classifications: undefined }), /finished data/);
  // The page shows the model's kind, not one it derives again.
  data.classifications.get('a')[0].kind = 'fixture-kind';
  assert.match(render(data), />fixture-kind<\/span>/);
});
