'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readMetafileDownload } = require('../../../../packwiz/pack_index.cjs');
const root = path.resolve(__dirname, '../../../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('every local mod pin agrees across dispositions, lock and packwiz metadata', () => {
  const dispositions = JSON.parse(read('tools/packwiz/migration/dispositions.json'));
  const lock = JSON.parse(read('tools/packwiz/migration/target-lock.json'));
  const decisions = new Map([
    ...Object.entries(dispositions.entries).map(([metafile, entry]) => [entry.metafile || metafile, entry]),
    ...dispositions.additions.map(entry => [entry.metafile, entry])
  ]);
  const targets = new Map(lock.entries.filter(entry => entry.target)
    .map(entry => [entry.target.metafile, entry.target]));
  const localMods = new Set([
    ...[...decisions].filter(([, entry]) => entry.target?.source === 'local').map(([file]) => file),
    ...[...targets].filter(([, target]) => target.source === 'local').map(([file]) => file)
  ].filter(file => file.startsWith('mods/')));
  assert.ok(localMods.size > 0, 'local mod coverage must not be empty');
  for (const file of localMods) {
    const selector = decisions.get(file)?.target;
    const target = targets.get(file);
    assert.ok(selector, `${file}: disposition target exists`);
    assert.ok(target, `${file}: lock target exists`);
    for (const field of ['source', 'filename', 'sha256', 'size']) {
      assert.equal(selector[field], target[field], `${file}: disposition/lock ${field}`);
    }
    const metadata = readMetafileDownload(read(file));
    assert.equal(metadata.filename, target.filename, `${file}: metadata filename`);
    assert.equal(metadata.hashFormat, 'sha256', `${file}: metadata hash format`);
    assert.equal(metadata.hash, target.sha256, `${file}: metadata hash`);
  }
});
