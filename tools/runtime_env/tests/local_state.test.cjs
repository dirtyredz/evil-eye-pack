'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FIXED } = require('../env.cjs');

test('Valhalla caches and Java live in local-state', () => {
  const state = 'C:/Users/dirty/.local-state';
  assert.equal(FIXED.ARTIFACTS, `${state}/evil-eye-pack/artifacts`);
  assert.equal(FIXED.STABLE_CACHE, `${FIXED.ARTIFACTS}/jobs/2026-10-31-world-trial-final/cache`);
  assert.equal(FIXED.MIGRATION_MODS, `${FIXED.ARTIFACTS}/migration/neoforge-1.21.1/cache/mods`);
  assert.equal(FIXED.JAVAS[21].java, `${state}/tools/evil-eye-pack/temurin-21/bin/java.exe`);
  assert.equal(FIXED.JAVAS[21].jcmd, `${state}/tools/evil-eye-pack/temurin-21/bin/jcmd.exe`);
});
