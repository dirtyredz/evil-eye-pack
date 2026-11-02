'use strict';
// Can the pack test share ANU with another project's running job? A pure decision over probe readings,
// plus the read-only PowerShell probe that produces them. Nothing here takes, edits or deletes a
// neighbour's lock or queue: it only reads <lock>\pid and <lock>\job and counts <queue>\*.ticket.
const cfg = require('./config.cjs');
const { q } = require('./ssh.cjs');

// Runs on ANU. Prints one JSON line: { neighbours: [{ lock, job, pid, queued }], freeGb, cpu: [pct...] }.
// A neighbour counts only while its pid is alive (a lock left by a dead process is stale, not held).
function probeScript(o = cfg) {
  return `
$neigh = @()
foreach ($n in @(${o.NEIGHBOUR_LOCKS.map(q).join(', ')})) {
  $pf = Join-Path $n 'pid'
  if (-not ((Test-Path $n) -and (Test-Path $pf))) { continue }
  $p = 0; [int]::TryParse((Get-Content $pf -TotalCount 1), [ref]$p) | Out-Null
  if (-not ($p -and (Get-Process -Id $p -ErrorAction SilentlyContinue))) { continue }
  $j = Get-Content (Join-Path $n 'job') -TotalCount 1 -ErrorAction SilentlyContinue
  $qd = Join-Path (Split-Path $n -Parent) 'queue'
  $qn = 0; if (Test-Path $qd) { $qn = @(Get-ChildItem $qd -Filter '*.ticket' -ErrorAction SilentlyContinue).Count }
  $neigh += @{ lock = $n; job = [string]$j; pid = $p; queued = $qn }
}
$free = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1048576, 2)
$cpu = @()
for ($i = 0; $i -lt ${o.CPU_SAMPLES}; $i++) {
  $cpu += [double](Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  if ($i -lt ${o.CPU_SAMPLES - 1}) { Start-Sleep -Milliseconds ${o.CPU_SAMPLE_MS} }
}
Write-Output ('PROBE ' + (@{ neighbours = $neigh; freeGb = $free; cpu = $cpu } | ConvertTo-Json -Compress -Depth 4))`;
}

function parseProbe(out) {
  const m = /PROBE (\{.*\})/.exec(out || '');
  if (!m) return null;
  const p = JSON.parse(m[1]);
  const one = (x) => (Array.isArray(x) ? x : x == null ? [] : [x]); // ConvertTo-Json unwraps 1-element arrays
  return { neighbours: one(p.neighbours), freeGb: p.freeGb, cpu: one(p.cpu).map(Number) };
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const jobName = (n) => n.job || `pid ${n.pid}`;

// reading: parseProbe() result, or null when the probe failed. thr: { minFreeGb, maxCpuPct }.
// Returns { mode: 'alone' | 'shared' | 'fallback', reason, neighbour, freeGb, cpuPct }.
function decide(reading, thr = { minFreeGb: cfg.MIN_FREE_GB, maxCpuPct: cfg.MAX_CPU_PCT }) {
  if (!reading) return { mode: 'fallback', reason: 'ANU capacity probe failed', neighbour: null };
  const cpuPct = mean(reading.cpu);
  const base = { freeGb: reading.freeGb, cpuPct: cpuPct == null ? null : Math.round(cpuPct) };
  if (!reading.neighbours.length) return { mode: 'alone', reason: 'no neighbour job holds ANU', neighbour: null, ...base };
  const neighbour = reading.neighbours.map(jobName).join(', ');
  const busy = (why) => ({ mode: 'fallback', reason: `ANU is running ${neighbour} and ${why}`, neighbour, ...base });
  if (typeof reading.freeGb !== 'number') return busy('free RAM could not be read');
  if (cpuPct == null || Number.isNaN(cpuPct)) return busy('CPU load could not be read');
  if (reading.freeGb < thr.minFreeGb) return busy(`only ${reading.freeGb} GB RAM is free (need ${thr.minFreeGb} GB)`);
  if (cpuPct >= thr.maxCpuPct) return busy(`CPU is ${Math.round(cpuPct)}% busy (limit ${thr.maxCpuPct}%)`);
  return { mode: 'shared', reason: `room beside ${neighbour}: ${reading.freeGb} GB free, CPU ${Math.round(cpuPct)}%`, neighbour, ...base };
}

module.exports = { probeScript, parseProbe, decide };
