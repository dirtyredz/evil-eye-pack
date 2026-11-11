'use strict';
// config/modernui/client.toml and config/terralith.json are rewritten by their mods on every launch.
// They are preserved files; the pack forces only the keys it needs through pack-owned-keys.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const P = require('../../../pack_index.cjs');
const { packFileDrift } = require('../../../install/installed_files.cjs');
const { loadEntries, applyOwnedKeys, previewOwnedKeys } = require('../../../install/owned_keys/pack_owned_keys.cjs');

const ROOT = path.resolve(__dirname, '../../../../..');
const MODERN = 'config/modernui/client.toml';
const TERRALITH = 'config/terralith.json';

const indexEntry = file => P.parseIndex(fs.readFileSync(path.join(ROOT, 'index.toml'), 'utf8')).files.find(f => f.file === file);

// What Modern UI writes back: the whole commented config, tab indented, zoom among ~200 lines.
const expandedModernUi = () => {
  const lines = ['#Modern UI client config', '[general]'];
  for (let i = 0; i < 90; i++) lines.push(`\t#Setting ${i} comment`, `\tsetting${i} = ${i}`);
  lines.push('\t#Enable zoom', '\tzoom = true', '');
  return lines.join('\n');
};
// Terralith writes 2-space JSON with its own module order and extra keys.
const expandedTerralith = () => JSON.stringify({ config_version: 1, modules: {
  custom_structures: true, extra_new_module: true, intro_message: false, recipe_changes: false,
  skylands: true, terrain_slabs: true, vanilla_stone_gen: true } }, null, 2) + '\n';

function withInstance(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mod-rewritten-'));
  try {
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
    }
    fn(dir);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('both files are indexed as preserved and policy agrees', () => {
  for (const file of [MODERN, TERRALITH]) {
    assert.equal(indexEntry(file).preserve, true, file);
    assert.equal(P.isPreservePath(file), true, file);
  }
});

test('mod-rewritten copies are not pack-file drift (never restored)', () => {
  const files = [MODERN, TERRALITH].map(f => indexEntry(f));
  withInstance({ [MODERN]: expandedModernUi(), [TERRALITH]: expandedTerralith() }, dir => {
    assert.deepEqual(packFileDrift(dir, files).map(f => f.file), []);
  });
});

test('owned keys leave a correctly rewritten file untouched, byte for byte', () => {
  withInstance({ [MODERN]: expandedModernUi(), [TERRALITH]: expandedTerralith() }, dir => {
    const before = [MODERN, TERRALITH].map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
    const labels = previewOwnedKeys(dir).filter(l => l.startsWith('config/modernui') || l.startsWith('config/terralith'));
    assert.deepEqual(labels, []);
    applyOwnedKeys(dir);
    assert.deepEqual([MODERN, TERRALITH].map(f => fs.readFileSync(path.join(dir, f), 'utf8')), before);
  });
});

test('owned keys force the pack values back inside the rewritten files and keep everything else', () => {
  const modern = expandedModernUi().replace('zoom = true', 'zoom = false');
  const terralith = JSON.stringify({ config_version: 1, modules: { extra_new_module: false, vanilla_stone_gen: false,
    recipe_changes: true, intro_message: false } }, null, 2) + '\n';
  withInstance({ [MODERN]: modern, [TERRALITH]: terralith }, dir => {
    const labels = previewOwnedKeys(dir).filter(l => l.startsWith('config/modernui') || l.startsWith('config/terralith'));
    assert.ok(labels.includes(`${MODERN} zoom`));
    assert.ok(labels.includes(`${TERRALITH} vanilla_stone_gen`));
    applyOwnedKeys(dir);
    const m = fs.readFileSync(path.join(dir, MODERN), 'utf8');
    assert.match(m, /^\tzoom = true$/m);
    assert.equal(m.split('\n').length, modern.split('\n').length, 'Modern UI body is kept');
    const t = JSON.parse(fs.readFileSync(path.join(dir, TERRALITH), 'utf8'));
    assert.equal(t.modules.vanilla_stone_gen, true);
    assert.equal(t.modules.recipe_changes, false);
    assert.equal(t.modules.skylands, true);
    assert.equal(t.modules.intro_message, false, 'intro_message is a player choice, not forced');
    assert.equal(t.modules.extra_new_module, false);
    assert.deepEqual(applyOwnedKeys(dir).filter(f => f === MODERN || f === TERRALITH), [], 'second run is a no-op');
  });
});

test('the shipped files carry the owned values (fresh installs and the list agree)', () => {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, TERRALITH), 'utf8'));
  for (const e of loadEntries().filter(x => x.file === TERRALITH)) assert.equal(t.modules[e.key], e.value, e.key);
  assert.match(fs.readFileSync(path.join(ROOT, MODERN), 'utf8'), /\[general\]\s+zoom = true/);
});
