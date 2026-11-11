'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { FIXED } = require('../env.cjs');
const cli = path.resolve(__dirname, '../paths.cjs');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, SMOKE_STABLE_CACHE: 'override cache', SMOKE_ARTIFACTS: 'override artifacts' } });

test('JDK descriptors expose a home and derived tools for each major', () => {
  for (const jdk of Object.values(FIXED.JAVAS)) {
    assert.equal(typeof jdk.home, 'string');
    for (const tool of ['java', 'javac', 'jar', 'jcmd', 'jstack']) assert.equal(jdk[tool], `${jdk.home}/bin/${tool}.exe`);
  }
  assert.equal(FIXED.ARTIFACT_JOBS, `${FIXED.ARTIFACTS}/jobs`);
});

test('path CLI prints one value, preserves overrides and supports FIXED install defaults', () => {
  for (const [key, expected] of [['STABLE_CACHE', 'override cache'], ['ARTIFACT_JOBS', 'override artifacts/jobs'], ['FIXED.STABLE_CACHE', FIXED.STABLE_CACHE], ['FIXED.JAVAS.21.javac', FIXED.JAVAS[21].javac]]) {
    const r = run(key);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, expected + '\n');
    assert.equal(r.stderr, '');
  }
  for (const args of [[], ['NO_SUCH_KEY'], ['JAVAS'], ['toString'], ['STABLE_CACHE', 'extra']]) {
    const r = run(...args);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, '');
  }
});

test('artifact guard roots can be supplied without redefining machine layout', () => {
  const { artifactJob } = require('../../data_io/path_guard.cjs');
  const root = path.resolve('fixture-jobs');
  assert.doesNotThrow(() => artifactJob(path.join(root, 'task'), root));
  assert.throws(() => artifactJob(root + '-sibling', root), /Job must be in artifact jobs/);
});

test('PowerShell bridge resolves paths from another working directory and fails closed', { skip: process.platform !== 'win32' }, () => {
  const bridge = path.resolve(__dirname, '../paths.ps1').replaceAll("'", "''");
  const invoke = key => spawnSync('powershell', ['-NoProfile', '-Command', `$ErrorActionPreference = 'Stop'; . '${bridge}'; Get-RuntimePath '${key}'`], { cwd: path.parse(process.cwd()).root, encoding: 'utf8' });
  const r = invoke('FIXED.JAVAS.21.jstack');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), FIXED.JAVAS[21].jstack);
  assert.notEqual(invoke('UNKNOWN').status, 0);
});

test('runners reject paths outside the fixed jobs root before staging or booting', async () => {
  const outside = path.resolve('outside-jobs');
  await assert.rejects(require('../../testing/world_trial/run.cjs').main(['snapshot', '--job', outside]), /Job must be in artifact jobs/);
  await assert.rejects(require('../../testing/client_mixin/run.cjs').main(['--out', outside, '--cache', outside]), /Job must be in artifact jobs/);
});

test('existing overrides stay independent of artifact output relocation', () => {
  const script = `const e = require(${JSON.stringify(path.resolve(__dirname, '../env.cjs'))}); console.log(JSON.stringify(e));`;
  const vars = { ...process.env, SMOKE_ARTIFACTS: 'relocated', SMOKE_JAVA_21: 'java override', SMOKE_JCMD_21: 'jcmd override' };
  delete vars.SMOKE_STABLE_CACHE; delete vars.SMOKE_MIGRATION_MODS;
  const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: vars });
  assert.equal(r.status, 0, r.stderr);
  const e = JSON.parse(r.stdout);
  assert.equal(e.JAVAS[21].java, 'java override');
  assert.equal(e.JAVAS[21].jcmd, 'jcmd override');
  assert.equal(e.STABLE_CACHE, FIXED.STABLE_CACHE);
  assert.equal(e.MIGRATION_MODS, FIXED.MIGRATION_MODS);
  assert.deepEqual(e.FIXED, FIXED);
});
