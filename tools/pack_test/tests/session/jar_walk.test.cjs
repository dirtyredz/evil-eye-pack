'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { walkJar } = require('../../../jar_data/walk.cjs');
const { walkJar: resourcesWalk } = require('../../session/resources.cjs');
// Small stored ZIP fixture, in directory order (the reader does not need CRC fields).
function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, value] of entries) {
    const n = Buffer.from(name), data = Buffer.from(value), l = Buffer.alloc(30), c = Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50); l.writeUInt16LE(n.length, 26);
    c.writeUInt32LE(0x02014b50); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    local.push(l, n, data); central.push(c, n); offset += l.length + n.length + data.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
test('jar walk preserves order, text, source labels, selection and explicit nesting', () => {
  const recipe = 'data/x/recipes/a.json';
  const inner = zip([[recipe, '{broken'], ['data/x/tags/fluids/a.json', '{}']]);
  const outer = zip([[recipe, '{}'], ['META-INF/jarjar/inner.jar', inner], ['data/x/loot_modifiers/a.json', '{}'], ['assets/x/models/item/a.json', '{}']]);
  const flat = [], inspected = [];
  walkJar(outer, 'outer', (...args) => flat.push(args), { matches: n => n.startsWith('data/'), inspect: n => inspected.push(n) });
  assert.deepEqual(flat.map(v => v[0]), [recipe, 'data/x/loot_modifiers/a.json']);
  assert.equal(inspected.length, 4);
  const nested = [];
  resourcesWalk(outer, 'outer', (...args) => nested.push(args));
  assert.deepEqual(nested, [[recipe, '{}', 'outer'], [recipe, '{broken', 'outer!inner.jar'], ['data/x/tags/fluids/a.json', '{}', 'outer!inner.jar']]);
});
