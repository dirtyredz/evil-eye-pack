'use strict';
// Runtime lanes on ANU: the Forge lane keeps its original directories, a NeoForge migration job gets its
// own stage, world cache and tool code, every lane shares the single pack-test lease lock, and Java 21
// is provisioned beside Java 17.
const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../../remote/config.cjs');
const provision = require('../../remote/provision.cjs');
const { describe: runtimeOf } = require('../../../server_smoke/runtime/runtime.cjs');

const FORGE = runtimeOf({ loader: 'forge', minecraft: '1.20.1', loaderVersion: '47.4.10' });
const NEO = runtimeOf({ loader: 'neoforge', minecraft: '1.21.1', loaderVersion: '21.1.265' });

test('migration jobs are isolated per runtime but share one lease lock', () => {
  const forge = cfg.lane(FORGE), neo = cfg.lane(NEO);
  assert.equal(forge.STAGE, `${cfg.ROOT}\\stage\\server`);
  assert.equal(forge.WORLDS, `${cfg.ROOT}\\cache\\worlds`);
  assert.equal(forge.CODE, `${cfg.ROOT}\\tools`);
  for (const k of ['STAGE', 'WORLDS', 'CODE']) {
    assert.notEqual(neo[k], forge[k], k);
    assert.ok(neo[k].startsWith(`${cfg.ROOT}\\lanes\\neoforge-1.21.1-21.1.265\\`), k);
  }
  assert.equal(cfg.LOCK, `${cfg.ROOT}\\lock`);
  assert.ok(!Object.values(neo).includes(cfg.LOCK) && !Object.values(forge).includes(cfg.LOCK), 'the lock is not per lane');
  assert.throws(() => cfg.lane(undefined), /needs the run runtime/);
});

test('ANU provisions a checksum-verified JDK per major side by side, never touching PATH or JAVA_HOME', () => {
  assert.deepEqual(provision.MAJORS, [17, 21]);
  assert.ok(provision.javaFor(21).java.endsWith('temurin-21\\bin\\java.exe'));
  assert.ok(provision.javaFor(17).jcmd.endsWith('temurin-17\\bin\\jcmd.exe'));
  assert.throws(() => provision.javaFor(8), /no Java 8/);
  for (const m of [17, 21]) {
    assert.ok(provision.INSTALL.includes(cfg.JAVAS[m].dir), `installs JDK ${m}`);
    assert.ok(provision.INSTALL.includes(`assets/latest/${m}/hotspot`), `uses the Adoptium ${m} API`);
  }
  assert.equal((provision.INSTALL.match(/\$sha = Verify \$zip \$pkg\.binary\.package\.checksum/g) || []).length, 2, 'each JDK zip is verified');
  assert.doesNotMatch(provision.INSTALL, /JAVA_HOME|SetEnvironmentVariable|\$env:Path/i);
});

test('every provisioning step fits the remote command line; oversized scripts are refused', async () => {
  const { encode, MAX_COMMAND, client } = require('../../remote/ssh.cjs');
  for (const step of provision.INSTALL_STEPS) assert.ok(('powershell -NoProfile -NonInteractive -EncodedCommand ' + encode(step)).length <= MAX_COMMAND);
  const c = client({ run: async () => ({ code: 0, out: '' }) });
  assert.throws(() => c.ps('x'.repeat(4000)), /cmd.exe truncates/);
});
