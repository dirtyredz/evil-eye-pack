<#
.SYNOPSIS
  Dot-sourced lifecycle for the ANU world server; loading this file performs no OS operations.
.DESCRIPTION
  Caller supplies $Server, $Ctl, $Backups, $Java, $Node, $Marker, $ArgsFile and $RconPort.
  Invoke-ServerStart/Stop/Status return the controller exit code (0, 2 or 3); unsafe operations throw.
  The controller alone exits the host. OS cmdlets and Invoke-Rcon can be replaced by callers/tests.
  Get-ServerProc needs only $Marker; known identities are PID plus CreationDate, never PID alone.
#>

function Say([string]$m) { Write-Host ("{0} {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) }
function Get-ServerProc($KnownProcess = $null) {
  $javaProcs = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'")
  # Stop keeps the identity learned before RCON shutdown, after the listeners have closed.
  # CreationDate is readable with a Limited token and prevents PID-reuse confusion.
  if ($KnownProcess) {
    return $javaProcs | Where-Object { $_.ProcessId -eq $KnownProcess.ProcessId -and $_.CreationDate -eq $KnownProcess.CreationDate }
  }
  $marked = @($javaProcs | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($Marker) })
  if ($marked.Count -gt 1) { throw 'Multiple world-server JVMs found; refusing an ambiguous operation.' }
  if ($marked.Count -eq 1) { return $marked[0] }
  # A Limited interactive token cannot read an elevated JVM's CommandLine. TCP ownership is
  # visible across that boundary. Require BOTH configured listeners on the same Java PID;
  # never identify an arbitrary process by a recycled PID or a single occupied port.
  $ports = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in 25565,25575 })
  $owners = @($ports | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($owners.Count -eq 1 -and @($ports | Select-Object -ExpandProperty LocalPort -Unique).Count -eq 2) {
    $candidate = @($javaProcs | Where-Object { $_.ProcessId -eq $owners[0] -and -not $_.CommandLine })
    if ($candidate.Count -eq 1) { return $candidate[0] }
  }
  if ($ports.Count -or @($javaProcs | Where-Object { -not $_.CommandLine }).Count) {
    throw 'Cannot identify world server safely (occupied server ports or unreadable Java command line). Retry from an elevated session; no JVM will be launched or killed.'
  }
}
function Invoke-Rcon([string]$Cmd) {
  $out = & $Node (Join-Path $Ctl 'mc-net.cjs') rcon 127.0.0.1 $RconPort (Join-Path $Ctl 'rcon.secret') $Cmd
  if ($LASTEXITCODE -ne 0) { throw "rcon '$Cmd' failed" }
  return $out
}

function Invoke-ServerStart {
  param([int]$TimeoutSec = 0, [ValidateSet('Normal','BelowNormal','AboveNormal','Idle')][string]$Priority = 'Normal')
  if (Get-ServerProc) { Say 'Already running.'; return 0 }
  # Serialize the check + launch across SSH and Command Deck sessions, including the boot window.
  # The handle is released on exit/crash; the empty file may remain safely.
  $startGuard = [IO.File]::Open((Join-Path $Ctl 'start.guard'), 'OpenOrCreate', 'ReadWrite', 'None')
  try {
    if (Get-ServerProc) { Say 'Already running.'; return 0 }
    $freeGb = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1MB, 1)
    Say "Free RAM before start: $freeGb GB"
    if ($freeGb -lt 12) { Say 'WARNING: under 12 GB free; the server may compete with a build or Plex.' }
    $limit = if ($TimeoutSec) { $TimeoutSec } else { 600 }
    $logs = Join-Path $Server 'logs'; New-Item -ItemType Directory -Force $logs | Out-Null
    $latest = Join-Path $logs 'latest.log'
    $startedAt = Get-Date
    $cmd = "cmd.exe /c $Java $Marker @user_jvm_args.txt @$ArgsFile nogui >> logs\console.log 2>&1"
    $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $Server }
    if ($r.ReturnValue -ne 0) { throw "Win32_Process.Create failed: $($r.ReturnValue)" }
    Say "Launched wrapper pid $($r.ProcessId); waiting up to ${limit}s for Done"
    $done = $false; $prioSet = $false
    for ($t = 0; $t -lt $limit; $t += 3) {
      Start-Sleep -Seconds 3
      $p = Get-ServerProc
      if ($p -and -not $prioSet) { try { (Get-Process -Id $p.ProcessId).PriorityClass = $Priority; $prioSet = $true } catch {} }
      if ((Test-Path -LiteralPath $latest) -and ((Get-Item -LiteralPath $latest).LastWriteTime -ge $startedAt.AddSeconds(-5))) {
        $hit = Select-String -LiteralPath $latest -Pattern ']: Done (' -SimpleMatch -ErrorAction SilentlyContinue | Select-Object -Last 1
        if ($hit) { $done = $true; Say $hit.Line.Trim(); break }
      }
      if (-not $p -and $t -gt 15) { Say 'Server process exited during start; see logs\latest.log and logs\console.log'; return 2 }
    }
    if (-not $done) { Say "Not Done after ${limit}s (server still running, check Status)"; return 2 }
    Say ("Started; java pid {0}, boot {1:n0}s" -f (Get-ServerProc).ProcessId, ((Get-Date) - $startedAt).TotalSeconds)
  } finally { $startGuard.Dispose() }
  return 0
}

function Invoke-ServerStop {
  param([int]$TimeoutSec = 0)
  $p = Get-ServerProc
  if (-not $p) { Say 'Not running.'; return 0 }
  $limit = if ($TimeoutSec) { $TimeoutSec } else { 180 }
  try { Say 'rcon save-all flush'; Invoke-Rcon 'save-all flush' | Out-Null; Say 'rcon stop'; Invoke-Rcon 'stop' | Out-Null } catch { Say "rcon failed: $($_.Exception.Message)" }
  for ($t = 0; $t -lt $limit -and (Get-ServerProc $p); $t += 2) { Start-Sleep -Seconds 2 }
  $remaining = Get-ServerProc $p
  if ($remaining) {
    # RCON is authenticated; forced killing additionally requires a fresh marker and the
    # original creation time, so a port-only identity or reused PID cannot be killed.
    if (-not $remaining.CommandLine -or -not $remaining.CommandLine.Contains($Marker) -or
        $remaining.ProcessId -ne $p.ProcessId -or $remaining.CreationDate -ne $p.CreationDate) {
      throw 'Server did not stop; cannot safely force-kill this process. Use an elevated Status/Stop.'
    }
    Say "Still running after ${limit}s; killing pid $($p.ProcessId)"
    Stop-Process -Id $p.ProcessId -Force; Start-Sleep -Seconds 2; return 3
  }
  Say 'Stopped cleanly.'
  return 0
}

function Invoke-ServerStatus {
  param()
  $p = Get-ServerProc
  if (-not $p) { Say 'State: STOPPED' } else {
    Say ("State: RUNNING pid {0}" -f $p.ProcessId)
    try {
      $pr = Get-Process -Id $p.ProcessId
      Say ("Up {0:n0} min, RSS {1:n1} GB, priority {2}" -f ((Get-Date) - $pr.StartTime).TotalMinutes, ($pr.WorkingSet64 / 1GB), $pr.PriorityClass)
    } catch { Say 'Process metrics unavailable to this principal.' }
    Say ("Port 25565 listening: {0}" -f [bool](Get-NetTCPConnection -LocalPort 25565 -State Listen -ErrorAction SilentlyContinue))
    try { Say ('Players: ' + (Invoke-Rcon 'list')) } catch { Say 'rcon unavailable' }
  }
  $latest = Join-Path $Server 'logs\latest.log'
  if (Test-Path -LiteralPath $latest) {
    $txt = @(Get-Content -LiteralPath $latest)
    $cu = @($txt | Where-Object { $_ -match "Can't keep up" }).Count
    $er = @($txt | Where-Object { $_ -match '/ERROR\]' }).Count
    $dn = $txt | Where-Object { $_ -match '\]: Done \(' } | Select-Object -Last 1
    Say "latest.log: $($txt.Count) lines, $er ERROR, $cu 'Can't keep up'; $dn"
  }
  $b = Get-ChildItem -LiteralPath $Backups -Filter 'world-*.tar.gz' -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -Last 1
  if ($b) { Say ("Newest backup: {0} ({1:n0} MB)" -f $b.Name, ($b.Length / 1MB)) } else { Say 'No backups yet.' }
  return 0
}
