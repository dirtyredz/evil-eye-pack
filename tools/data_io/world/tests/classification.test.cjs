'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { classifyFile, inventory } = require('../inventory.cjs');

test('world classification preserves supported, auxiliary, external and unknown formats', () => {
  const cases = {
    nbt: ['level.dat', 'playerdata/player.dat', 'generated/mod/structures/house.nbt'],
    region: ['region/r.0.0.mca', 'DIM-1/entities/r.-1.2.mca', 'dimensions/mod/moon/region/bad.mca'],
    auxiliary: ['level.dat_old', 'backup.zip', 'mod/backups/old.dat', 'session.lock', 'icon.png',
      'stats/player.json', 'advancements/player.json', 'serverconfig/mod.toml', 'serverconfig/mod.snbt',
      'poi/r.0.0.mca', 'DIM-1/poi/r.0.0.mca'],
    external: ['region/c.0.0.mcc', 'orphan.mcc'],
    unsupported: ['unknown.json', 'unknown.bin', 'r.0.0.mca', 'serverconfig/nested/mod.toml']
  };
  for (const [kind, files] of Object.entries(cases)) for (const file of files) {
    const result = classifyFile(file);
    assert.equal(result.kind, kind, file);
    assert.equal(Boolean(result.excludedReason), ['auxiliary', 'external'].includes(kind), file);
    assert.equal(Boolean(result.unsupportedReason), ['unsupported', 'external'].includes(kind), file);
  }
});

test('inventory parses supported inputs and skips auxiliary and orphan chunk bytes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'classification-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of ['structure.nbt', 'region/bad.mca', 'mod/backups/old.dat', 'poi/r.0.0.mca', 'region/c.0.0.mcc']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), 'bad');
  }
  const result = inventory(root);
  assert.equal(result.files, 5);
  assert.deepEqual(result.errors.map(e => e.file).sort(), ['region/bad.mca', 'structure.nbt']);
});
