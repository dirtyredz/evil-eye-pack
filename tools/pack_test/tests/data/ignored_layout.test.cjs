'use strict';
// Real pinned-jar guard: every data file a pinned jar ships only in the other Minecraft version's folder
// layout is restored in kubejs/data (1.21 path), has a twin in the running layout, or is left out with a
// reason in policy.json ignoredLayout. A new or updated jar with lost data fails here, before any boot.
// Missing cached jars are an error, not a skip (as in the dedup gate).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pinnedJars, defaultJarDirs, root } = require('../../../dedup/catalog.cjs');
const { listEntries, readEntry } = require('../../../data_io/zip_reader.cjs');
const { classify, dataPath, layoutFor } = require('../../../data_io/resource_layout.cjs');
const { readRuntime } = require('../../../server_smoke/runtime/runtime.cjs');
const { triageIgnoredLayout } = require('../../checks/ignored_layout.cjs');

const policy = JSON.parse(fs.readFileSync(path.join(root, 'tools/pack_test/data/policy.json'), 'utf8'));
const runtime = layoutFor(readRuntime(path.join(root, 'pack.toml')).minecraft);
const other = runtime === '1.21' ? '1.20' : '1.21';

// Names in a jar and its jar-in-jar libraries (central directories only, nested jars inflated).
function names(bytes, out = []) {
  for (const e of listEntries(bytes)) {
    if (e.name.endsWith('.jar')) names(readEntry(bytes, e), out); else out.push(e.name);
  }
  return out;
}

test('data in the other version\'s folder layout is restored, twinned or reasoned', () => {
  const files = [], present = new Set();
  for (const jar of pinnedJars(defaultJarDirs())) {
    for (const n of names(jar.bytes)) {
      const c = classify(n);
      if (!c || c.layout === 'both') continue;
      if (c.layout === other) files.push({ source: jar.filename, kind: c.kind, id: c.id, path: c.path, ns: c.ns });
      else present.add(c.kind.startsWith('tags/') ? `${jar.filename}|${c.kind}|${c.id}` : `${c.kind}|${c.id}`);
    }
  }
  const restored = (f) => fs.existsSync(path.join(root, 'kubejs', dataPath(runtime, f.kind, f.ns, f.path)));
  // Tags merge, so only the same jar's twin covers one; a loot table or recipe twin from any jar replaces it.
  const twin = (f) => present.has(f.kind.startsWith('tags/') ? `${f.source}|${f.kind}|${f.id}` : `${f.kind}|${f.id}`);
  const t = triageIgnoredLayout(files, (f) => twin(f) || restored(f), policy.ignoredLayout || {});
  assert.deepEqual(t.lost.map((f) => `${f.source}: ${f.kind}|${f.id}`), [], 'ship a 1.21 equivalent in kubejs/data or add a reasoned policy ignoredLayout entry');
  assert.deepEqual(t.unused, [], 'policy ignoredLayout entries that no pinned jar needs any more');
});
