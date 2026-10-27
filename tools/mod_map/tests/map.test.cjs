'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMods } = require('../toml.cjs');
const { group, connect, classify, cost } = require('../model.cjs');
const { parseTiming } = require('../timing.cjs');
const { render } = require('../page.cjs');
const node = (key, dependencies = []) => ({ key, name: key, mods: [{ id: key, name: key, description: 'A mod', dependencies: [] }], dependencies, bundled: [], side: 'both' });

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
test('transitive shared dependencies are not charged to tops; optional edges are excluded', () => {
  const a = node('a', ['private', 'shared']), b = node('b', ['shared']);
  a.mods[0].dependencies.push({ id: 'b', mandatory: false });
  const nodes = [a, b, node('private', ['leaf']), node('leaf'), node('shared', ['base']), node('base')];
  connect(nodes);
  const result = group(nodes);
  assert.deepEqual(result.groups.find(g => g.key === 'a').exclusive.map(n => n.key).sort(), ['leaf', 'private']);
  assert.deepEqual(result.shared.flatMap(c => c.nodes.map(n => n.key)).sort(), ['base', 'shared']);
  assert.equal(result.shared[0].users.length, 2);
  assert.equal(result.groups.length, 2);
});
test('cycles form one top; a multi-mod jar is indivisible and missing dependencies are visible', () => {
  const a = node('a', ['b']), b = node('b', ['a']);
  a.mods.push({ id: 'extra', name: 'Extra', dependencies: [{ id: 'missing', mandatory: true, side: 'CLIENT' }] });
  assert.match(connect([a, b])[0], /missing mandatory/);
  const result = group([a, b]);
  assert.equal(result.groups.length, 1); assert.equal(result.groups[0].cycle, true);
  assert.equal(result.groups[0].tops.length, 2);
});
test('embedded library with two providers stays shared and is counted once', () => {
  const nodes = [node('a', ['embedded']), node('b', ['embedded']), { ...node('embedded'), embedded: true }];
  const result = group(nodes);
  assert.equal(result.shared.length, 1);
  assert.deepEqual(result.shared[0].users.sort(), ['a', 'b']);
  assert.equal(cost(result.groups[0].tops, { mods: { a: { ms: 10 }, embedded: { ms: 50 } } }).ms, 10);
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
  const html = render({ nodes: [n], ...group([n]), timing: { mods: {}, warnings: [] }, registries: {}, boot: { wallSeconds: 1 }, warnings: [], identity: {}, pins: [], created: 'now' });
  assert.ok(html.includes('&lt;script&gt;alert(1)'));
  assert.ok(!html.includes('<script>bad()'));
  assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=/i.test(html));
  assert.ok(html.includes('not measured'));
});
