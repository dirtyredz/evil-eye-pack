'use strict';
// Sign-off fixes: the ANU abort handle dies with the agent, the remote kill is command-line guarded, and
// the heartbeat lock never reads a half-written owner.json as stale.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { abortRegistry } = require('../session/aborts.cjs');
const { killScript } = require('../remote/scripts.cjs');
const { lockScript, refreshDirLock } = require('../remote/lease/dir_lock.cjs');
const { makeRunServer, STAGE_RUNTIME } = require('../session/prepare.cjs');

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const win = { skip: process.platform !== 'win32' };

// ---- runOnAnu with the SSH side stubbed: the abort callback is armed while the agent runs, then gone.
function loadRunOnAnu(stubs) {
  const names = { ssh: 'ssh', sync: 'sync', provision: 'provision', capacity: 'capacity', evidence: 'evidence', dirLock: 'lease/dir_lock' };
  const saved = {};
  for (const [k, file] of Object.entries(names)) {
    const id = require.resolve(`../remote/${file}.cjs`);
    require(id);
    saved[id] = { ...require.cache[id].exports };
    Object.assign(require.cache[id].exports, stubs[k]);
  }
  const anuId = require.resolve('../remote/anu.cjs');
  delete require.cache[anuId];
  const { runOnAnu } = require(anuId);
  return { runOnAnu, restore() { delete require.cache[anuId]; for (const [id, ex] of Object.entries(saved)) Object.assign(require.cache[id].exports, ex); } };
}

function fakeAnu(scripts) {
  const ssh = {
    host: 'fake',
    ps: async (s) => {
      scripts.push(s);
      if (s.includes('ALIVE=')) return { code: 0, out: 'ALIVE=True\n{"state":"done","boot":{"ok":1},"world":{}}' };
      return { code: 0, out: '' };
    },
    must: async (s) => (s.includes('Win32_Process') ? 'PID 4242' : ''),
    scpTo: async () => ({ code: 0, out: '' })
  };
  return {
    ssh: { connect: async () => ssh },
    sync: { syncDir: async () => ({ changed: 0, removed: 0, bytes: 0 }) },
    provision: { ensureProvisioned: async () => {} },
    capacity: { probeScript: () => 'probe', parseProbe: () => ({}), decide: () => ({ mode: 'alone', reason: 'test' }) },
    evidence: { pullEvidence: async () => {} },
    dirLock: { acquire: async (ssh, runId) => ({ ok: true, lease: { runId, claimId: 'test-claim' } }) }
  };
}

test('the abort callback is disarmed once the ANU agent reaches a terminal state', async () => {
  const runDir = tmp('packtest-anu-');
  const scripts = [];
  const reg = abortRegistry();
  let armedWhileRunning = 0;
  const { runOnAnu, restore } = loadRunOnAnu(fakeAnu(scripts));
  try {
    const r = await runOnAnu({
      stageDir: runDir, runDir, input: {}, seed: '1', port: 1, heap: '1G', boot: { timeout: 10, probeTimeout: 10 }, freshWorld: false,
      scope: {}, log: () => {}, pollMs: 1,
      onAbort: (fn) => { const d = reg.register(fn); armedWhileRunning = reg.size(); return d; }
    });
    assert.deepEqual(r.boot, { ok: 1 });
    assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'job.json'), 'utf8')).lease.claimId, 'test-claim');
    assert.equal(armedWhileRunning, 1);
    assert.equal(reg.size(), 0, 'registry empty after the terminal state');
    const before = scripts.length;
    await reg.runAll();
    assert.equal(scripts.length, before, 'a later Ctrl+C sends no kill to ANU');
    assert.ok(!scripts.some((s) => s.includes('taskkill')));
  } finally { restore(); fs.rmSync(runDir, { recursive: true, force: true }); }
});

test('local copies and remote sync exclude the same stage runtime paths', async () => {
  const root = fs.mkdtempSync(path.join(__dirname, '.stage-test-'));
  const stageDir = path.join(root, 'stage');
  const runDir = path.join(root, 'run');
  const serverDir = path.join(root, 'server');
  const stubs = fakeAnu([]);
  let stageSyncs = 0;
  stubs.sync.syncDir = async (ssh, scope, from, to, opts) => {
    if (opts.label === 'stage') {
      stageSyncs++;
      for (const name of STAGE_RUNTIME) {
        assert.equal(opts.skip(name), true);
        assert.equal(opts.skip(`${name}/nested`), true);
        assert.equal(opts.skip(`${name}-kept`), false);
        assert.equal(opts.skip(`config/${name}`), false);
      }
    }
    return { changed: 0, removed: 0, bytes: 0 };
  };
  const { runOnAnu, restore } = loadRunOnAnu(stubs);
  try {
    fs.mkdirSync(stageDir);
    fs.mkdirSync(runDir);
    for (const name of STAGE_RUNTIME) {
      fs.writeFileSync(path.join(stageDir, name), 'stale');
      fs.writeFileSync(path.join(stageDir, `${name}-kept`), 'kept');
    }
    makeRunServer(stageDir, serverDir, { seed: '1', port: 1, heap: '1G' });
    for (const name of STAGE_RUNTIME) {
      assert.equal(fs.existsSync(path.join(serverDir, name)), false);
      assert.equal(fs.readFileSync(path.join(serverDir, `${name}-kept`), 'utf8'), 'kept');
    }
    await runOnAnu({ stageDir, runDir, input: {}, boot: { timeout: 10, probeTimeout: 10 }, scope: {}, log() {}, pollMs: 1 });
    assert.equal(stageSyncs, 1);
  } finally { restore(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('abortRegistry: a disposed callback never runs, a live one does', async () => {
  const reg = abortRegistry();
  const hits = [];
  const off = reg.register(() => hits.push('a'));
  reg.register(() => hits.push('b'));
  off();
  await reg.runAll();
  assert.deepEqual(hits, ['b']);
});

// ---- the kill guard, run for real in PowerShell against processes whose command line does / does not match.
const psKill = (pid, jobFile) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', killScript(pid, jobFile)], { encoding: 'utf8' }).stdout.trim();

test('killScript refuses a PID whose command line is not this agent and job; kills when it matches', win, async () => {
  const dir = tmp('packtest-kill-');
  const script = path.join(dir, 'pack_test', 'remote', 'agent.cjs');
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.writeFileSync(script, 'setInterval(() => {}, 1000)');
  const job = path.join(dir, 'job.json');
  const agent = spawn(process.execPath, [script, job], { stdio: 'ignore' });
  const other = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  try {
    assert.match(psKill(other.pid, job), /MISMATCH/);
    assert.match(psKill(agent.pid, path.join(dir, 'other-job.json')), /MISMATCH/);
    assert.equal(other.exitCode, null);
    assert.equal(agent.exitCode, null);
    assert.match(psKill(agent.pid, job), /KILLED/);
    await new Promise((r) => (agent.exitCode !== null || agent.signalCode ? r() : agent.once('exit', r)));
    assert.match(psKill(agent.pid, job), /GONE/);
  } finally { agent.kill(); other.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- heartbeat lock acquisition (the real PowerShell lockScript aimed at a temp dir)
const acquire = (lockDir, staleMs = 600000) => spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', lockScript('run-new', lockDir, staleMs)], { encoding: 'utf8' }).stdout.trim();
const age = (p, ms) => { const t = new Date(Date.now() - ms); fs.utimesSync(p, t, t); };

for (const [label, body] of [['missing', null], ['malformed', '{"owner":"run-old","at":']]) {
  test(`lock with ${label} owner.json: fresh dir is BUSY, old dir is stale`, win, () => {
    const root = tmp('packtest-lock-');
    const lock = path.join(root, 'lock');
    try {
      fs.mkdirSync(lock);
      if (body) fs.writeFileSync(path.join(lock, 'owner.json'), body);
      assert.match(acquire(lock), /BUSY/);
      assert.ok(fs.existsSync(lock));
      age(lock, 20 * 60 * 1000);
      assert.equal(acquire(lock), 'LOCKED');
      assert.equal(JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'), 'utf8')).owner, 'run-new');
      assert.deepEqual(fs.readdirSync(lock), ['owner.json']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test('lock with a readable owner.json still decides by heartbeat age', win, () => {
  const root = tmp('packtest-lock-');
  const lock = path.join(root, 'lock');
  try {
    fs.mkdirSync(lock);
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'run-old', at: Date.now() }));
    assert.match(acquire(lock), /BUSY pack-test run run-old/);
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ owner: 'run-old', at: Date.now() - 20 * 60 * 1000 }));
    assert.equal(acquire(lock), 'LOCKED');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('heartbeat write is temp file + rename, and leaves no temp behind', () => {
  const root = tmp('packtest-hb-');
  const dir = path.join(root, 'lock');
  const calls = [];
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'owner.json'), JSON.stringify({ owner: 'run-a', claimId: 'claim-a' }));
  const w = fs.writeFileSync;
  const rn = fs.renameSync;
  fs.writeFileSync = (p, ...a) => { calls.push(['write', path.basename(String(p))]); return w(p, ...a); };
  fs.renameSync = (a, b) => { calls.push(['rename', path.basename(String(a)), path.basename(String(b))]); return rn(a, b); };
  try { refreshDirLock(dir, { runId: 'run-a', claimId: 'claim-a' }); } finally { fs.writeFileSync = w; fs.renameSync = rn; }
  try {
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], 'write');
    assert.notEqual(calls[0][1], 'owner.json');
    assert.deepEqual(calls[1], ['rename', calls[0][1], 'owner.json']);
    assert.deepEqual(fs.readdirSync(dir), ['owner.json']);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'owner.json'), 'utf8')).owner, 'run-a');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
