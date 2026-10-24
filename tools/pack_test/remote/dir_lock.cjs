'use strict';
// The ANU single-job lock: one contract, three sides. The lock is a directory <cfg.LOCK> holding
// owner.json = { owner, claimId, at, ... } (run id, immutable acquisition id, heartbeat epoch ms), replaced atomically.
//   take    the launcher, over SSH, via lockScript(): refuses while another owner's heartbeat is younger than
//           cfg.LOCK_STALE_MS, otherwise removes the stale lock and takes it (PowerShell).
//   refresh the agent of the same run, on ANU, every 30 s (refreshDirLock); another owner's lock is refused.
//   release the owner only (releaseDirLock here; releaseScript() for a launcher whose agent never started).
// A neighbour project's lock is not part of this contract: capacity.cjs only reads it.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const cfg = require('./config.cjs');
const { q } = require('./ssh.cjs');

const OWNER_FILE = 'owner.json';

// PowerShell, run by the launcher. Prints LOCKED or BUSY <why>. A readable owner.json decides by its
// heartbeat age; a missing or malformed one (a heartbeat mid-replace, or a launcher between mkdir and its
// first write) is BUSY until the lock DIRECTORY is older than the stale threshold (its mtime moves on every
// atomic heartbeat replace). Parameters exist so tests can aim the script at a temp directory.
function lockScript(owner, lockDir = cfg.LOCK, staleMs = cfg.LOCK_STALE_MS, claimId = randomUUID()) {
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
Set-Content -Encoding ascii -LiteralPath $tmp -Value (@{ owner = ${q(owner)}; claimId = ${q(claimId)}; at = $now; host = 'valhalla-launcher' } | ConvertTo-Json -Compress)
Move-Item -Force -LiteralPath $tmp -Destination (Join-Path $lock '${OWNER_FILE}')
Write-Output 'LOCKED'`;
}

const releaseScript = (owner, claimId) => `$lock = ${q(cfg.LOCK)}; $f = Join-Path $lock '${OWNER_FILE}'
if (Test-Path $f) { $o = Get-Content -Raw $f | ConvertFrom-Json; if ($o.owner -eq ${q(owner)} -and $o.claimId -and $o.claimId -eq ${q(claimId)}) { Remove-Item -Recurse -Force $lock } }`;

// One attempt, no waiting: a busy ANU means this run goes to Valhalla. -> { ok: true, claimId } | { ok: false, why }
async function acquire(ssh, owner) {
  const claimId = randomUUID();
  const out = await ssh.must(lockScript(owner, cfg.LOCK, cfg.LOCK_STALE_MS, claimId), { timeoutMs: 60000 });
  return /LOCKED/.test(out) ? { ok: true, claimId } : { ok: false, why: (out.match(/BUSY .*/) || ['BUSY'])[0].slice(5) };
}

// Node side never acquires: missing, unreadable or replaced claims are terminal.
function refreshDirLock(dir, owner, claimId) {
  const f = path.join(dir, OWNER_FILE);
  const check = () => {
    const cur = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!claimId || cur?.owner !== owner || cur.claimId !== claimId) throw new Error(`lock held by ${cur?.owner}; claim lost`);
  };
  check();
  // Stage before the final ownership check. A takeover removes this unique temp too,
  // so a refresh suspended after that check cannot rename over the new owner's file.
  const tmp = `${f}.tmp-${randomUUID()}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify({ owner, claimId, at: Date.now(), host: os.hostname(), pid: process.pid }), { flag: 'wx' });
    check();
    // Atomic replace: readers never see a half-written owner.json.
    fs.renameSync(tmp, f);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  const now = new Date();
  try { fs.utimesSync(dir, now, now); } catch { /* the rename already moved the directory mtime */ }
}

// Removes the lock only when this run owns it.
function releaseDirLock(dir, owner, claimId) {
  try {
    const cur = JSON.parse(fs.readFileSync(path.join(dir, OWNER_FILE), 'utf8'));
    if (!claimId || cur.owner !== owner || cur.claimId !== claimId) return false;
  } catch { return false; }
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = { acquire, lockScript, releaseScript, refreshDirLock, releaseDirLock, OWNER_FILE };
