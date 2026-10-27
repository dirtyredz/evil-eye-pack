'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMods } = require('../toml.cjs');
const { connect, classify, cost, familyModel } = require('../model.cjs');
const { parseTiming } = require('../timing.cjs');
const { render } = require('../page.cjs');
const node = (key, dependencies = []) => ({ key, name: key, mods: [{ id: key, name: key, description: 'A mod', dependencies: [] }], dependencies, bundled: [], side: 'both' });
const registries = keys => ({ items: keys.map(key => key + ':item'), blocks: [], entities: [] });

test('TOML multiple mods, quoted dependency table, comments and multiline descriptions', () => {
  const mods = parseMods(`[[mods]]
modId = "alpha" # comment
displayName = 'Alpha # not a comment'
description = """
First line with \\"quotes\\".
Second line."""
[[dependencies."alpha"]]
modId = "lib"
mandatory = true # yes
side = "BOTH"
[[dependencies.alpha]]
modId = 'optional'
mandatory = false
[[mods]]
modId = 'beta'
description = '''literal \\n text'''
`);
  assert.equal(mods.length, 2);
  assert.equal(mods[0].name, 'Alpha # not a comment');
  assert.equal(mods[0].description, 'First line with "quotes". Second line.');
  assert.equal(mods[0].dependencies[0].mandatory, true);
  assert.equal(mods[0].dependencies[1].mandatory, false);
  assert.equal(mods[1].description, 'literal \\n text');
  assert.throws(() => parseMods('[[mods]]\nmodId="x"\ndescription="""unfinished'), /Unterminated/);
});
test('connection resolves mandatory providers, excludes optional links and reports missing dependencies', () => {
  const a = node('a');
  a.mods[0].dependencies.push({ id: 'base', mandatory: true, side: 'BOTH' }, { id: 'optional', mandatory: false, side: 'BOTH' }, { id: 'missing', mandatory: true, side: 'CLIENT' });
  const warnings = connect([a, node('base'), node('optional')]);
  assert.deepEqual(a.dependencies, ['base']);
  assert.deepEqual(a.optional, ['optional']);
  assert.match(warnings[0], /missing mandatory/);
});
test('family nests an add-on of an add-on under its immediate mandatory dependency', () => {
  const nodes = [node('base'), node('addon', ['base']), node('nested', ['addon'])];
  const model = familyModel(nodes, registries(['base', 'addon', 'nested']));
  assert.equal(model.families.length, 1);
  assert.equal(model.families[0].roots[0].key, 'base');
  assert.deepEqual(model.families[0].members.map(n => n.key).sort(), ['addon', 'base', 'nested']);
  const html = render({ nodes, ...model, timing: { mods: {}, warnings: [] }, registries: registries(['base', 'addon', 'nested']), boot: { wallSeconds: 1 }, warnings: [], identity: {}, pins: [], created: 'now' });
  assert.ok(html.indexOf('base</strong>') < html.indexOf('addon</strong>'));
  assert.ok(html.indexOf('addon</strong>') < html.indexOf('nested</strong>'));
});
test('bridge add-on belongs to two families and is visibly marked shared in both', () => {
  const nodes = [node('ars'), node('ae2'), node('ars-addon', ['ars']), node('ae2-addon', ['ae2']), node('bridge', ['ars', 'ae2'])];
  const regs = registries(nodes.map(n => n.key));
  const model = familyModel(nodes, regs);
  assert.deepEqual([...model.memberships.get('bridge')].sort(), ['ae2', 'ars']);
  assert.equal(model.families.filter(f => f.members.some(n => n.key === 'bridge')).length, 2);
  const html = render({ nodes, ...model, timing: { mods: {}, warnings: [] }, registries: regs, boot: { wallSeconds: 1 }, warnings: [], identity: {}, pins: [], created: 'now' });
  assert.match(html, /shared ×2 · also used by: ae2/);
  assert.match(html, /shared ×2 · also used by: ars/);
});
test('library with content users never becomes a family root', () => {
  const nodes = [node('framework'), node('one', ['framework']), node('two', ['framework'])];
  const model = familyModel(nodes, registries(['one', 'two']), { framework: { kind: 'library/API', reason: 'fixture framework' } });
  assert.equal(model.families.length, 0);
});
test('shared library nests under every family user, counts in each total, and orphan is a compact trim row', () => {
  const nodes = [node('alpha'), node('alpha-addon', ['alpha', 'shared-lib']), node('alpha-second', ['alpha', 'shared-lib']), node('beta'), node('beta-addon', ['beta', 'shared-lib']), node('shared-lib'), node('orphan-lib')];
  const regs = registries(['alpha', 'alpha-addon', 'alpha-second', 'beta', 'beta-addon']);
  const overrides = {
    'shared-lib': { kind: 'library/API', reason: 'fixture library' },
    'orphan-lib': { kind: 'library/API', reason: 'fixture orphan' }
  };
  const model = familyModel(nodes, regs, overrides);
  assert.deepEqual(model.families.map(f => f.libraries.map(n => n.key)), [['shared-lib'], ['shared-lib']]);
  assert.deepEqual(model.unusedLibraries.map(n => n.key), ['orphan-lib']);
  assert.ok(!model.ungrouped.some(n => n.key.endsWith('-lib')));
  const timing = { mods: { alpha: { ms: 10 }, beta: { ms: 20 }, 'shared-lib': { ms: 50 } }, warnings: [] };
  const html = render({ nodes, ...model, timing, registries: regs, boot: { wallSeconds: 1 }, warnings: [], identity: {}, pins: [], created: 'now' }, overrides);
  assert.equal((html.match(/shared-lib<\/strong>/g) || []).length, 3);
  assert.equal((html.match(/shared ×2 · also used by:/g) || []).length, 3);
  assert.match(html, /alpha[\s\S]*0\.060 s/);
  assert.match(html, /beta[\s\S]*0\.070 s/);
  assert.doesNotMatch(html, /Shared libraries/);
  assert.match(html, /Unused libraries <span class="candidate">free trims · 1/);
});
const line = (time, thread, message) => `[27Oct2026 ${time}] [${thread}/TRACE] [net.minecraftforge.fml.javafmlmod.FMLModContainer/LOADING]: ${message}`;
test('TRACE pairs parallel workers, repeated event identities, midnight and unknown intervals', () => {
  const trace = [line('23:59:59.900', 'w1', 'Loading mod instance a of type A'),
    line('23:59:59.910', 'w2', 'Loading mod instance b of type B'),
    line('23:59:59.950', 'w2', 'Loaded mod instance b of type B'),
    line('00:00:00.100', 'w1', 'Loaded mod instance a of type A').replace('27Oct', '28Oct'),
    line('00:00:00.101', 'main', 'Firing event for modid a : Event@abc').replace('27Oct', '28Oct'),
    line('00:00:00.121', 'main', 'Fired event for modid a : Event@abc').replace('27Oct', '28Oct'),
    line('00:00:00.122', 'main', 'Firing event for modid missing : Event@def').replace('27Oct', '28Oct'),
    line('00:00:01.000', 'main', 'Done (1.0s)!').replace('27Oct', '28Oct')].join('\n');
  const t = parseTiming(trace);
  assert.equal(t.mods.a.ms, 220); assert.equal(t.mods.b.ms, 40);
  assert.equal(t.mods.missing, undefined); assert.equal(t.warnings.length, 1);
  assert.equal(t.logToDoneSeconds, 1.1);
});
test('classification has evidence; unknown and client timing never become zero', () => {
  const n = node('a');
  assert.equal(classify(n.mods[0], n, true, { items: [], blocks: [], entities: [] }).kind, 'library/API');
  assert.equal(classify(n.mods[0], { ...n, side: 'client' }, true, {}).kind, 'client-only/cosmetic');
  assert.equal(cost([n], { mods: {} }).ms, null);
});
test('HTML escapes metadata and embeds controls without network resources', () => {
  const n = node('evil'); n.name = '<script>alert(1)</script>'; n.mods[0].description = '</script><script>bad()</script>';
  const html = render({ nodes: [n], ...familyModel([n], {}), timing: { mods: {}, warnings: [] }, registries: {}, boot: { wallSeconds: 1 }, warnings: [], identity: {}, pins: [], created: 'now' });
  assert.ok(html.includes('&lt;script&gt;alert(1)'));
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=/i.test(html));
  assert.ok(html.includes('not measured'));
});
