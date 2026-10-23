'use strict';
// The ANU single-job lock: one contract, three sides. The lock is a directory <cfg.LOCK> holding
// owner.json = { owner, at, ... } (owner = the run id, at = epoch ms of the last heartbeat), always replaced atomically.
//   take    the launcher, over SSH, via lockScript(): refuses while another owner's heartbeat is younger than
//           cfg.LOCK_STALE_MS, otherwise removes the stale lock and takes it (PowerShell).
//   refresh the agent of the same run, on ANU, every 30 s (refreshDirLock); another owner's lock is refused.
//   release the owner only (releaseDirLock here; releaseScript() for a launcher whose agent never started).
// A neighbour project's lock is not part of this contract: capacity.cjs only reads it.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cfg = require('./config.cjs');
const { q } = require('./ssh.cjs');

const OWNER_FILE = 'owner.json';

// PowerShell, run by the launcher. Prints LOCKED or BUSY <why>. A readable owner.json decides by its
// heartbeat age; a missing or malformed one (a heartbeat mid-replace, or a launcher between mkdir and its
// first write) is BUSY until the lock DIRECTORY is older than the stale threshold (its mtime moves on every
// atomic heartbeat replace). Parameters exist so tests can aim the script at a temp directory.
function lockScript(owner, lockDir = cfg.LOCK, staleMs = cfg.LOCK_STALE_MS) {
  return `
$lock = ${q(lockDir)}; $staleMs = ${staleMs}; $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if (Test-Path $lock) {
  $o = $null; try { $o = Get-Content -Raw (Join-Path $lock '${OWNER_FILE}') | ConvertFrom-Json } catch {}
  if ($o -and $o.at) {
    if (($now - [int64]$o.at) -lt $staleMs) { Write-Output "BUSY pack-test run $($o.owner)"; exit 0 }
  } else {
    $dirAge = $now - ([DateTimeOffset](Get-Item -LiteralPath $lock).LastWriteTimeUtc).ToUnixTimeMilliseconds()
    if ($dirAge -lt $staleMs) { Write-Output 'BUSY pack-test lock (owner unreadable)'; exit 0 }
  }
  Remove-Item -Recurse -Force $lock
}
try { New-Item -ItemType Directory $lock -ErrorAction Stop | Out-Null } catch { Write-Output 'BUSY lock race'; exit 0 }
$tmp = Join-Path $lock '${OWNER_FILE}.tmp'
Set-Content -Encoding ascii -LiteralPath $tmp -Value (@{ owner = ${q(owner)}; at = $now; host = 'valhalla-launcher' } | ConvertTo-Json -Compress)
Move-Item -Force -LiteralPath $tmp -Destination (Join-Path $lock '${OWNER_FILE}')
Write-Output 'LOCKED'`;
}

const releaseScript = (owner) => `$lock = ${q(cfg.LOCK)}; $f = Join-Path $lock '${OWNER_FILE}'
if (Test-Path $f) { $o = Get-Content -Raw $f | ConvertFrom-Json; if ($o.owner -eq ${q(owner)}) { Remove-Item -Recurse -Force $lock } }`;

// One attempt, no waiting: a busy ANU means this run goes to Valhalla. -> { ok: true } | { ok: false, why }
async function acquire(ssh, owner) {
  const out = await ssh.must(lockScript(owner), { timeoutMs: 60000 });
  return /LOCKED/.test(out) ? { ok: true } : { ok: false, why: (out.match(/BUSY .*/) || ['BUSY'])[0].slice(5) };
}

// Node side, on ANU: write the heartbeat. Throws when another owner holds the lock.
function refreshDirLock(dir, owner) {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, OWNER_FILE);
  let cur = null;
  try { cur = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* new or torn: ours now */ }
  if (cur && cur.owner && cur.owner !== owner) throw new Error(`lock held by ${cur.owner}`);
  // Atomic replace: a reader sees the old or the new owner.json, never a half-written one.
  const tmp = `${f}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify({ owner, at: Date.now(), host: os.hostname(), pid: process.pid }));
  fs.renameSync(tmp, f);
  const now = new Date();
  try { fs.utimesSync(dir, now, now); } catch { /* the rename already moved the directory mtime */ }
}

// Removes the lock only when this run owns it.
function releaseDirLock(dir, owner) {
  try { if (JSON.parse(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8')).owner !== owner) return false; } catch { return false; }
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = { acquire, lockScript, releaseScript, refreshDirLock, releaseDirLock, OWNER_FILE };
