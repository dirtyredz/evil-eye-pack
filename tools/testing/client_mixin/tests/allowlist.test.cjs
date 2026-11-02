'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadAllowlist } = require('../allowlist.cjs');

test('committed client-mixin allow-list is exact and reasoned', () => {
  const data = loadAllowlist(path.join(__dirname, '../allowlist.json'));
  assert.equal(data.missingTargets.length, 13);
  assert.ok(data.missingTargets.every(entry => entry.mod !== "inventoryprofilesnext"));
  assert.equal(data.unhandled.length, 6);
  const knownMinor = data.missingTargets.filter(entry => entry['known-minor']);
  assert.deepEqual(knownMinor.map(entry => entry['known-minor']), ['dk-2d33cee0']);
  assert.match(knownMinor[0].mod + knownMinor[0].config + knownMinor[0].mixin, /railways/);
});

test('known-minor entries require a Docket reference', t => {
  const fs = require('node:fs');
  const os = require('node:os');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'client-mixin-allowlist-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const file = path.join(temp, 'allowlist.json');
  fs.writeFileSync(file, JSON.stringify({
    missingTargets: [{ mod: 'railways', config: 'railways.mixins.json', mixin: 'Example', target: 'missing.Target', reason: 'A reviewed minor behavior loss.', 'known-minor': true }],
    unhandled: [],
  }));
  assert.throws(() => loadAllowlist(file), /known-minor.*Docket/);
});
