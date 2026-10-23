'use strict';
// The ANU target, driven from Valhalla: connect, provision if needed, take the heartbeat lock (waiting
// for our own or a neighbour's running job), sync the staged server and the tool code, start the agent
// detached, poll its status, pull the evidence back into the local run folder, clean the remote run.
// Returns { boot, world, timings } or { fallback: reason } when ANU cannot be used (the caller runs
// locally). Errors after the agent has started are real failures, never silent fallbacks.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cfg = require('./config.cjs');
const { connect, q } = require('./ssh.cjs');
const { syncDir } = require('./sync.cjs');
const { ensureProvisioned, nodeExe, javaExe, jcmdExe } = require('./provision.cjs');

const TOOLS_DIR = path.resolve(__dirname, '../..');
const CODE_DIRS = ['server_smoke', 'pack_test', 'emi_coverage'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STAGE_SKIP = (rel) => /^(smoke-world|logs|crash-reports|pack_test)(\/|$)/.test(rel);

// Takes G:\...\lock unless our own fresh lock or a live neighbour job holds the machine.
// Prints LOCKED or BUSY <why>.
function lockScript(owner) {
  return `
$lock = ${q(cfg.LOCK)}; $staleMs = ${cfg.LOCK_STALE_MS}; $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
foreach ($n in @(${cfg.NEIGHBOUR_LOCKS.map(q).join(', ')})) {
  $pf = Join-Path $n 'pid'
  if ((Test-Path $n) -and (Test-Path $pf)) {
    $p = 0; [int]::TryParse((Get-Content $pf -TotalCount 1), [ref]$p) | Out-Null
    if ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue)) { $j = Get-Content (Join-Path $n 'job') -TotalCount 1 -ErrorAction SilentlyContinue; Write-Output "BUSY neighbour job $j (pid $p, $n)"; exit 0 }
  }
}
if (Test-Path $lock) {
  $o = $null; try { $o = Get-Content -Raw (Join-Path $lock 'owner.json') | ConvertFrom-Json } catch {}
  if ($o -and ($now - [int64]$o.at) -lt $staleMs) { Write-Output "BUSY pack-test run $($o.owner)"; exit 0 }
  Remove-Item -Recurse -Force $lock
}
try { New-Item -ItemType Directory $lock -ErrorAction Stop | Out-Null } catch { Write-Output 'BUSY lock race'; exit 0 }
Set-Content -Encoding ascii -LiteralPath (Join-Path $lock 'owner.json') -Value (@{ owner = ${q(owner)}; at = $now; host = 'valhalla-launcher' } | ConvertTo-Json -Compress)
Write-Output 'LOCKED'`;
}

const releaseScript = (owner) => `$lock = ${q(cfg.LOCK)}; $f = Join-Path $lock 'owner.json'
if (Test-Path $f) { $o = Get-Content -Raw $f | ConvertFrom-Json; if ($o.owner -eq ${q(owner)}) { Remove-Item -Recurse -Force $lock } }`;

// Win32_Process.Create: the agent is not a child of sshd, so it survives the session; BelowNormal is
// inherited by the Java server it starts.
const launchScript = (jobFile) => `
$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ PriorityClass = [uint32]16384; ShowWindow = [uint16]0 }
$cmd = '"' + ${q(nodeExe)} + '" "' + ${q(`${cfg.CODE}\\pack_test\\remote\\agent.cjs`)} + '" "' + ${q(jobFile)} + '"'
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = ${q(cfg.ROOT)}; ProcessStartupInformation = $si }
if ($r.ReturnValue -ne 0) { throw "Win32_Process.Create returned $($r.ReturnValue)" }
Write-Output "PID $($r.ProcessId)"`;

const statusScript = (runDir, agentPid) => `$s = Join-Path ${q(runDir)} 'status.json'
$alive = [bool](Get-Process -Id ${Number(agentPid)} -ErrorAction SilentlyContinue)
$body = if (Test-Path $s) { Get-Content -Raw $s } else { '{}' }
Write-Output ("ALIVE=$alive"); Write-Output $body`;

// Kills a remote agent and everything it started (used on interrupt).
const killScript = (agentPid) => `taskkill /PID ${Number(agentPid)} /T /F 2>&1 | Out-Null; Write-Output done`;

async function acquire(ssh, owner, waitMs, log) {
  const until = Date.now() + waitMs;
  let last = '';
  for (;;) {
    const out = await ssh.must(lockScript(owner), { timeoutMs: 60000 });
    if (/LOCKED/.test(out)) return { ok: true };
    const why = (out.match(/BUSY .*/) || ['BUSY'])[0];
    if (why !== last) { log(`ANU busy (${why.slice(5)}); waiting up to ${Math.round(waitMs / 60000)} min`); last = why; }
    if (Date.now() >= until) return { ok: false, why: why.slice(5) };
    await sleep(30000);
  }
}

async function pullEvidence(ssh, scope, remoteRun, runDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'packtest-pull-'));
  try {
    const remoteTar = `${remoteRun}\\evidence.tar`;
    await ssh.must(`Set-Location ${q(remoteRun)}; if (-not (Test-Path evidence)) { New-Item -ItemType Directory evidence | Out-Null }; tar -cf evidence.tar evidence agent.log status.json job.json; if ($LASTEXITCODE -ne 0) { throw "tar exit $LASTEXITCODE" }`, { timeoutMs: 600000 });
    const local = path.join(tmp, 'evidence.tar');
    const r = await ssh.scpFrom(remoteTar, local);
    if (r.code !== 0) throw new Error(`evidence download failed: ${r.out.slice(0, 300)}`);
    const remoteFiles = path.join(runDir, 'remote');
    fs.mkdirSync(remoteFiles, { recursive: true });
    const x = await scope.run(cfg.LOCAL_TAR, ['-xf', local, '-C', remoteFiles], { timeoutMs: 600000 });
    if (x.code !== 0) throw new Error(`evidence unpack failed: ${x.out.slice(0, 300)}`);
    // Probe payloads, logs and crash reports join the locally staged evidence (resources, pack config).
    fs.cpSync(path.join(remoteFiles, 'evidence'), path.join(runDir, 'evidence'), { recursive: true });
    fs.rmSync(path.join(remoteFiles, 'evidence'), { recursive: true, force: true });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// o: { stageDir, runDir, input, seed, port, heap, boot, freshWorld, anuWait (s), scope, log, onAbort, onSynced }
async function runOnAnu(o) {
  const { scope, log } = o;
  const timings = {};
  let t = Date.now();
  const ssh = await connect(scope);
  if (!ssh) return { fallback: 'ANU unreachable over SSH (anu, anu-byname)' };
  timings.connect = (Date.now() - t) / 1000;
  log(`ANU reachable as ${ssh.host}`);
  await ensureProvisioned(ssh, scope, log);
  const runId = path.basename(o.runDir);
  const lock = await acquire(ssh, runId, o.anuWait * 1000, log);
  if (!lock.ok) return { fallback: `ANU busy for ${o.anuWait} s (${lock.why})` };
  const remoteRun = `${cfg.RUNS}\\${runId}`;
  let agentPid = null;
  try {
    t = Date.now();
    const st = await syncDir(ssh, scope, o.stageDir, cfg.STAGE, { incoming: cfg.INCOMING, skip: STAGE_SKIP, log, label: 'stage' });
    for (const d of CODE_DIRS) await syncDir(ssh, scope, path.join(TOOLS_DIR, d), `${cfg.CODE}\\${d}`, { incoming: cfg.INCOMING, skip: (r) => /^tests(\/|$)/.test(r), log, label: `tools-${d}` });
    timings.sync = (Date.now() - t) / 1000;
    if (o.onSynced) o.onSynced(); // the local stage may change again now
    log(`synced stage (${st.changed} changed, ${st.removed} removed, ${(st.bytes / 1048576).toFixed(1)} MiB) in ${Math.round(timings.sync)} s`);
    const job = {
      runId, root: cfg.ROOT, stageDir: cfg.STAGE, worldCache: cfg.WORLDS, lock: cfg.LOCK, input: o.input, seed: o.seed, port: o.port, heap: o.heap,
      boot: o.boot, freshWorld: o.freshWorld, java: javaExe, jcmd: jcmdExe
    };
    const jobLocal = path.join(o.runDir, 'job.json');
    fs.writeFileSync(jobLocal, JSON.stringify(job, null, 1));
    await ssh.must(`New-Item -ItemType Directory -Force ${q(remoteRun)} | Out-Null`);
    const up = await ssh.scpTo(jobLocal, `${remoteRun}\\job.json`);
    if (up.code !== 0) throw new Error(`job upload failed: ${up.out.slice(0, 300)}`);
    const launched = await ssh.must(launchScript(`${remoteRun}\\job.json`));
    agentPid = Number((launched.match(/PID (\d+)/) || [])[1]);
    if (!agentPid) throw new Error(`agent did not start: ${launched.slice(0, 300)}`);
    if (o.onAbort) o.onAbort(() => ssh.ps(killScript(agentPid), { timeoutMs: 30000 }));
    log(`agent started on ANU (pid ${agentPid}); waiting for the boot`);
    t = Date.now();
    const deadline = Date.now() + (o.boot.timeout + o.boot.probeTimeout + 600) * 1000;
    let status = null;
    let misses = 0;
    for (;;) {
      await sleep(15000);
      const r = await ssh.ps(statusScript(remoteRun, agentPid), { timeoutMs: 60000 });
      if (r.code !== 0) { if (++misses >= 8) throw new Error(`lost contact with ANU while the run was in progress: ${r.out.slice(0, 200)}`); continue; }
      misses = 0;
      const alive = /ALIVE=True/.test(r.out);
      try { status = JSON.parse(r.out.slice(r.out.indexOf('{'))); } catch { status = {}; }
      if (status.state === 'done' || status.state === 'error') break;
      if (!alive) throw new Error('the ANU agent exited without writing a final status');
      if (Date.now() > deadline) { await ssh.ps(killScript(agentPid), { timeoutMs: 30000 }); throw new Error('the ANU run exceeded its deadline; agent killed'); }
    }
    timings.remote = (Date.now() - t) / 1000;
    t = Date.now();
    await pullEvidence(ssh, scope, remoteRun, o.runDir);
    timings.pull = (Date.now() - t) / 1000;
    await ssh.ps(`Remove-Item -Recurse -Force ${q(remoteRun)}`, { timeoutMs: 300000 });
    if (status.state === 'error') throw new Error(`ANU agent failed: ${status.error}`);
    return { boot: status.boot, world: status.world, timings: { ...timings, ...Object.fromEntries(Object.entries(status.timings || {}).map(([k, v]) => [`anu_${k}`, v])) } };
  } finally {
    if (!agentPid) await ssh.ps(releaseScript(runId), { timeoutMs: 60000 }); // the agent releases its own lock
  }
}

module.exports = { runOnAnu, lockScript, launchScript };
