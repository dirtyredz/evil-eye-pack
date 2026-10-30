'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadScripts, readRepoText } = require('./support/harness.cjs');
const { resolvePinnedJar } = require('../../packwiz/pinned_jar.cjs');
const { defaultJarDirs } = require('../../dedup/catalog.cjs');
const { listEntries } = require('../../data_io/zip_reader.cjs');
const root = path.resolve(__dirname, '../../..');

test('CLEAN hides all 50 pinned Roundwood legacy items and preserves current generic shapes', () => {
  const jar = resolvePinnedJar(fs.readFileSync(path.join(root, 'mods/roundwood.pw.toml'), 'utf8'), defaultJarDirs(root));
  const entries = listEntries(jar.bytes);
  const models = entries.map(e => /^assets\/roundwood\/models\/item\/(.+)\.json$/.exec(e.name)?.[1]).filter(Boolean);
  const blocks = new Set(entries.map(e => /^assets\/roundwood\/blockstates\/(.+)\.json$/.exec(e.name)?.[1]).filter(Boolean));
  // Includes the window_trim item alias as well as the 49 legacy per-material blocks.
  const legacy = models.filter(id => id === 'window_trim' || blocks.has(id) && /^[a-z_]+_round_(door|trim|window)$/.test(id)).map(id => 'roundwood:' + id).sort();
  assert.equal(legacy.length, 50);
  const env = { global: {}, logs: [] }; loadScripts(env, ['diagnostics', 'collections', 'policy']);
  const P = env.global.emiCuration.policy, policy = P.load(readRepoText);
  const hidden = id => P.isStackHidden(policy, { id, isItem: true, nbt: () => null });
  for (const id of legacy) assert.equal(hidden(id), true, id);
  for (const id of ['round_door', 'round_trim', 'round_window', 'arched_door', 'double_arched_door', 'archway', 'frameless_window']) {
    assert.ok(models.includes(id), id);
    assert.equal(hidden('roundwood:' + id), false, id);
  }
  const list = JSON.parse(readRepoText('config/emi-curation/roundwood-legacy.json'));
  assert.deepEqual([...list.items].sort(), legacy, 'no stale or extra hidden IDs');
});
