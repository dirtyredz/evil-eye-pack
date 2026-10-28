'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMods } = require('../../inventory/mods_toml.cjs');

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
  assert.deepEqual(mod.dependencies, [{ id: 'kotlinforforge', mandatory: true, side: 'BOTH', range: '', source: 'modLoader' }]);
});
