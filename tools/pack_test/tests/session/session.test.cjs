'use strict';
// One boot per run, injection before the boot, evidence after it, artifact-root guard, offline analysis.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const prep = require('../../session/prepare.cjs');
const { checkDestination } = require('../../session/run_meta.cjs');
const { WORLD } = require('../../stage_runtime.cjs');
const { execute } = require('../../session/execute.cjs');
const { analyzeRun } = require('../../analyze.cjs');
const { loadToolData } = require('../../verdict/policy.cjs');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'packtest-session-')); }

function fakeStage(root) {
  const stage = path.join(root, 'stage');
  for (const d of ['mods', 'libraries/x', 'config', 'kubejs/server_scripts']) fs.mkdirSync(path.join(stage, d), { recursive: true });
  fs.writeFileSync(path.join(stage, 'mods/a.jar'), 'jar');
  fs.writeFileSync(path.join(stage, 'libraries/x/lib.jar'), 'lib');
  fs.writeFileSync(path.join(stage, 'config/c.toml'), 'k = 1\n');
  fs.mkdirSync(path.join(stage, 'logs'));
  fs.writeFileSync(path.join(stage, 'logs/old.log'), 'stale');
  return stage;
}

test('writable run folders must be under the artifacts root and outside every checkout', () => {
  const artifacts = 'C:/a/artifacts';
  assert.doesNotThrow(() => checkDestination('C:/a/artifacts/pack-test/runs/r1', { artifacts, checkouts: ['C:/a/repo'] }));
  assert.throws(() => checkDestination('C:/a/elsewhere/r1', { artifacts, checkouts: [] }), /outside the artifacts root/);
  assert.throws(() => checkDestination('C:/a/artifacts/repo/r1', { artifacts, checkouts: ['C:/a/artifacts/repo'] }), /inside a checkout/);
});

test('execute boots exactly once, injects the probe before the boot and keeps the evidence after it', async () => {
  const root = tmp();
  try {
    const stage = fakeStage(root);
    const runDir = path.join(root, 'run');
    const input = { token: 't-1', crafts: [] };
    const calls = [];
    const bootImpl = async (serverDir, opts, log, deps) => {
      assert.equal(deps.java, "job/java.exe");
      assert.equal(deps.jcmd, "job/jcmd.exe");
      calls.push(serverDir);
      assert.ok(fs.existsSync(path.join(serverDir, 'kubejs/server_scripts/pack_test/bootstrap.js')), 'probe injected before boot');
      assert.deepEqual(JSON.parse(fs.readFileSync(path.join(serverDir, 'pack_test/in/run.json'), 'utf8')), input);
      assert.ok(!fs.existsSync(path.join(serverDir, 'logs/old.log')), 'stage logs are not copied');
      assert.equal(fs.statSync(path.join(serverDir, 'mods/a.jar')).nlink >= 1, true);
      assert.equal(opts.complete(), false);
      fs.writeFileSync(path.join(serverDir, 'pack_test/out/manifest.json'), JSON.stringify({ token: 't-1' }));
      assert.equal(opts.complete(), true);
      fs.mkdirSync(path.join(serverDir, 'logs'), { recursive: true });
      fs.writeFileSync(path.join(serverDir, 'logs/latest.log'), 'Done (1.0s)!\n');
      fs.mkdirSync(path.join(serverDir, WORLD));
      fs.writeFileSync(path.join(serverDir, WORLD, 'level.dat'), 'w');
      return { completed: true };
    };
    const o = { stageDir: stage, runDir, worldCache: path.join(root, 'worlds'), input, seed: '1', port: 1, heap: '1G', boot: { probeTimeout: 5 }, java: 'job/java.exe', jcmd: 'job/jcmd.exe', bootImpl };
    const r = await execute(o, () => {});
    assert.equal(calls.length, 1);
    assert.ok(fs.existsSync(path.join(runDir, 'evidence/probe/manifest.json')));
    assert.ok(fs.existsSync(path.join(runDir, 'evidence/logs/latest.log')));
    assert.ok(!fs.existsSync(path.join(runDir, 'server')), 'the throwaway server is removed');
    assert.equal(r.world.saved, true);
    // The next run with the same mods and seed reuses the generated world.
    const runDir2 = path.join(root, 'run2');
    const r2 = await execute({ ...o, runDir: runDir2, bootImpl: async (serverDir) => { assert.ok(fs.existsSync(path.join(serverDir, WORLD, 'level.dat'))); return { completed: true }; } }, () => {});
    assert.equal(r2.world.reused, true);
    assert.equal(fs.readFileSync(path.join(stage, 'mods/a.jar'), 'utf8'), 'jar', 'the stage is untouched');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('evidence is collected even when the boot throws', async () => {
  const root = tmp();
  try {
    const stage = fakeStage(root);
    const runDir = path.join(root, 'run');
    const bootImpl = async (serverDir) => {
      fs.mkdirSync(path.join(serverDir, 'crash-reports'));
      fs.writeFileSync(path.join(serverDir, 'crash-reports/crash.txt'), '-- MOD x --');
      throw new Error('boom');
    };
    await assert.rejects(execute({ stageDir: stage, runDir, worldCache: path.join(root, 'w'), input: { token: 't' }, seed: '1', port: 1, heap: '1G', boot: {}, bootImpl, keepServer: true }, () => {}), /boom/);
    assert.ok(fs.existsSync(path.join(runDir, 'evidence/crash-reports/crash.txt')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('offline analysis of a run without a probe manifest is an invalid run (exit 2), and still writes the report', () => {
  const root = tmp();
  try {
    const runDir = path.join(root, 'run');
    fs.mkdirSync(path.join(runDir, 'evidence/logs'), { recursive: true });
    fs.writeFileSync(path.join(runDir, 'evidence/logs/latest.log'), '[00:00:00] [Server thread/INFO] [minecraft/DedicatedServer]: Done (3.0s)! For help, type "help"\n');
    fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ input: { token: 'x' }, boot: { completed: false, completeTimedOut: true }, meta: {}, errors: [] }));
    const model = analyzeRun(runDir, { data: loadToolData() });
    assert.equal(model.verdict.exit, 2);
    assert.ok(fs.existsSync(path.join(runDir, 'report.json')));
    assert.match(fs.readFileSync(path.join(runDir, 'summary.txt'), 'utf8'), /INVALID RUN/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
