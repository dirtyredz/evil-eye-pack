'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMods } = require('../mod_metadata.cjs');

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
test('custom mods.toml modLoader is a mandatory dependency', () => {
  const [mod] = parseMods('modLoader="kotlinforforge"\n[[mods]]\nmodId="inventoryprofilesnext"\ndisplayName="Inventory Profiles Next"');
  assert.deepEqual(mod.dependencies, [{ id: 'kotlinforforge', type: 'required', mandatory: true, side: 'BOTH', range: '', source: 'modLoader' }]);
});
const { readJarMods } = require('../mod_metadata.cjs');
const { zip } = require('../../malware_guard/tests/fixtures.cjs');

test('NeoForge dependency types map to required/optional and reject unknown types', () => {
  const [mod] = parseMods(`[[mods]]
modId="neo"
version="1.2.3"
[[dependencies.neo]]
modId="neoforge"
type="required"
versionRange="[21.1,)"
[[dependencies.neo]]
modId="jei"
type="optional"
[[dependencies.neo]]
modId="oculus"
type="incompatible"
[[dependencies.neo]]
modId="sodium"
type="DISCOURAGED"
`);
  assert.equal(mod.version, '1.2.3');
  assert.deepEqual(mod.dependencies.map(d => [d.id, d.type, d.mandatory]), [
    ['neoforge', 'required', true], ['jei', 'optional', false], ['oculus', 'incompatible', false], ['sodium', 'discouraged', false]]);
  assert.throws(() => parseMods('[[mods]]\nmodId="x"\n[[dependencies.x]]\nmodId="y"\ntype="needed"'), /Unsupported dependency type/);
});

test('jar reader prefers neoforge.mods.toml, substitutes the manifest version and walks declared jar-in-jar', () => {
  const inner = zip([['META-INF/neoforge.mods.toml', '[[mods]]\nmodId="lib"\nversion="2.0"\n']]);
  const bytes = zip([
    ['META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\r\nImplementation-Version: 5.4.0\r\n'],
    ['META-INF/neoforge.mods.toml', '[[mods]]\nmodId="host"\nversion="${file.jarVersion}"\n'],
    ['META-INF/mods.toml', '[[mods]]\nmodId="legacy"\n'],
    ['META-INF/jarjar/metadata.json', JSON.stringify({ jars: [{ path: 'META-INF/jarjar/lib.jar' }] })],
    ['META-INF/jarjar/lib.jar', inner]
  ]);
  const units = readJarMods(bytes, 'host.jar');
  assert.deepEqual(units.map(u => [u.source, u.loader, u.bundled, u.mods.map(m => `${m.id}@${m.version}`)]), [
    ['host.jar', 'neoforge', false, ['host@5.4.0']], ['host.jar!META-INF/jarjar/lib.jar', 'neoforge', true, ['lib@2.0']]]);
  const forgeOnly = readJarMods(zip([['META-INF/mods.toml', '[[mods]]\nmodId="old"\n']]), 'old.jar');
  assert.equal(forgeOnly[0].loader, 'forge');
  assert.equal(readJarMods(zip([['a.txt', 'x']]), 'plain.jar')[0].loader, null);
});

test('arrays of inline mod tables (Modrinth-generated datapack mods) are read like [[mods]]', () => {
  const mods = parseMods("modLoader = 'javafml'\nauthors = ['a, b']\nmods = [\n\t{ modId = 'mr_huts', version = '1.3.0', displayName = 'Huts, Epic', description = 'Replaces { braces }' },\n\t{ modId = \"second\" },\n]\n");
  assert.deepEqual(mods.map(m => [m.id, m.version, m.name]), [['mr_huts', '1.3.0', 'Huts, Epic'], ['second', null, 'second']]);
  assert.equal(mods[0].description, 'Replaces { braces }');
  assert.throws(() => parseMods('mods = [\n{ modId = "x" }\n'), /Unterminated TOML array/);
});
