<#
.SYNOPSIS
  Runs ON ANU: configure, start, stop, report on and back up the Evil Eye world server. Called by
  anu-world-server.ps1 over ssh; not meant to be run by hand.
.DESCRIPTION
  Server root G:\evil-eye-pack-ci\server (NeoForge 21.1.265, MC 1.21.1, Java 21), world folder
  evil-eye-world. The JVM runs detached (Win32_Process.Create + cmd redirect to logs\console.log), so it
  survives the ssh session. Detection uses -Dewl.server=anu-world or both TCP listeners when a Limited
  token cannot read the command line. Ambiguous detection fails closed; Start uses an exclusive guard.
  Graceful stop and RCON commands go through RCON on 127.0.0.1:25575 (password in ctl\rcon.secret; the
  firewall only opens 25565 to the LAN). Never touches Plex, E:\, G:\Work, CommandDeckCI or the cd-ci account.
  Exit codes: 0 ok, 1 usage/precondition, 2 server exited during start / not ready in time,
  3 stop needed a forced kill, 4 backup failed.
.PARAMETER Op
  Configure | Start | Stop | Status | Backup | Manifest (sha256 of every world file into ctl\world.sha256).
.PARAMETER HeapGb
  Max heap in GB (Configure). Default 10 (ANU has 32 GB; leaves room for builds and Plex).
.PARAMETER OpUuid
  Minecraft UUID to op at level 4 (Configure). Needs -OpName.
.PARAMETER OpName
  Player name for the ops entry (Configure).
.PARAMETER LanCidr
  Remote subnet allowed through the firewall rule on 25565 (Configure). Default 192.168.1.0/24.
.PARAMETER Priority
  Process priority for the server JVM (Start). Default Normal.
.PARAMETER TimeoutSec
  Seconds to wait for "Done" (Start, default 600) or for exit (Stop, default 180).
.PARAMETER Keep
  Backups to keep (Backup). Default 8.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('Configure','Start','Stop','Status','Backup','Manifest')][string]$Op,
  [int]$HeapGb = 10,
  [string]$OpUuid,
  [string]$OpName,
  [string]$LanCidr = '192.168.1.0/24',
  [ValidateSet('Normal','BelowNormal','AboveNormal','Idle')][string]$Priority = 'Normal',
  [int]$TimeoutSec = 0,
  [int]$Keep = 8
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$Server  = 'G:\evil-eye-pack-ci\server'
$Ctl     = Join-Path $Server 'ctl'
$Backups = 'G:\evil-eye-pack-ci\server-backups'
$Java    = 'C:\Tools\evil-eye-pack\temurin-21\bin\java.exe'
$Node    = 'C:\Tools\evil-eye-pack\node-v22.20.0-win-x64\node.exe'
$World   = 'evil-eye-world'
$Marker  = '-Dewl.server=anu-world'
$ArgsFile = 'libraries\net\neoforged\neoforge\21.1.265\win_args.txt'
$RconPort = 25575

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
function Write-Lf([string]$Path, [string]$Text) { [IO.File]::WriteAllText($Path, ($Text -replace "`r`n", "`n"), (New-Object Text.UTF8Encoding $false)) }

switch ($Op) {
  'Configure' {
    New-Item -ItemType Directory -Force $Ctl, $Backups, (Join-Path $Server 'logs') | Out-Null
    $secret = Join-Path $Ctl 'rcon.secret'
    if (-not (Test-Path -LiteralPath $secret)) { Write-Lf $secret ([guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')) }
    $pw = (Get-Content -LiteralPath $secret -Raw).Trim()
    Write-Lf (Join-Path $Server 'eula.txt') "eula=true`n"
    Write-Lf (Join-Path $Server 'server.properties') @"
level-name=$World
level-seed=
online-mode=true
enforce-secure-profile=true
server-ip=
server-port=25565
max-players=6
view-distance=8
simulation-distance=6
difficulty=normal
gamemode=survival
allow-flight=true
spawn-protection=0
max-tick-time=-1
white-list=false
pvp=true
motd=Evil Eye (ANU)
enable-rcon=true
rcon.port=$RconPort
rcon.password=$pw
enable-query=false
sync-chunk-writes=true

"@
    # Stable's client JVM flags (G1, tuned for the pack), heap sized for ANU. -Xms below -Xmx keeps room for others.
    Write-Lf (Join-Path $Server 'user_jvm_args.txt') @"
-Xms4G
-Xmx${HeapGb}G
-XX:+UseG1GC
-XX:+ParallelRefProcEnabled
-XX:MaxGCPauseMillis=200
-XX:+UnlockExperimentalVMOptions
-XX:+DisableExplicitGC
-XX:G1NewSizePercent=30
-XX:G1MaxNewSizePercent=40
-XX:G1HeapRegionSize=8M
-XX:G1ReservePercent=20
-XX:G1HeapWastePercent=5
-XX:G1MixedGCCountTarget=4
-XX:InitiatingHeapOccupancyPercent=15
-XX:G1MixedGCLiveThresholdPercent=90
-XX:G1RSetUpdatingPauseTimePercent=5
-XX:SurvivorRatio=32
-XX:+PerfDisableSharedMem
-XX:MaxTenuringThreshold=1

"@
    if ($OpUuid) {
      if (-not $OpName) { throw 'OpUuid needs OpName' }
      Write-Lf (Join-Path $Server 'ops.json') ("[`n  {`n    `"uuid`": `"$OpUuid`",`n    `"name`": `"$OpName`",`n    `"level`": 4,`n    `"bypassesPlayerLimit`": false`n  }`n]`n")
    }
    $rule = 'Evil Eye World Server (LAN 25565)'
    if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) { Remove-NetFirewallRule -DisplayName $rule }
    New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort 25565 -RemoteAddress $LanCidr -Action Allow -Profile Any | Out-Null
    Say "Configured: heap ${HeapGb}G, firewall '$rule' allows $LanCidr, ops=$([bool]$OpUuid)"
  }
  'Start' {
    if (Get-ServerProc) { Say 'Already running.'; exit 0 }
    # Serialize the check + launch across SSH and Command Deck sessions, including the boot window.
    # The handle is released on exit/crash; the empty file may remain safely.
    $startGuard = [IO.File]::Open((Join-Path $Ctl 'start.guard'), 'OpenOrCreate', 'ReadWrite', 'None')
    try {
      if (Get-ServerProc) { Say 'Already running.'; exit 0 }
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
        if (-not $p -and $t -gt 15) { Say 'Server process exited during start; see logs\latest.log and logs\console.log'; exit 2 }
      }
      if (-not $done) { Say "Not Done after ${limit}s (server still running, check Status)"; exit 2 }
      Say ("Started; java pid {0}, boot {1:n0}s" -f (Get-ServerProc).ProcessId, ((Get-Date) - $startedAt).TotalSeconds)
    } finally { $startGuard.Dispose() }
  }
  'Stop' {
    $p = Get-ServerProc
    if (-not $p) { Say 'Not running.'; exit 0 }
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
      Stop-Process -Id $p.ProcessId -Force; Start-Sleep -Seconds 2; exit 3
    }
    Say 'Stopped cleanly.'
  }
  'Status' {
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
  }
  'Manifest' {
    $root = Join-Path $Server $World
    Get-ChildItem -LiteralPath $root -Recurse -File -Force | Where-Object { $_.Name -ne 'session.lock' } | ForEach-Object {
      $rel = $_.FullName.Substring($root.Length + 1).Replace([string][char]92, '/')
      '{0}  ./{1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower(), $rel
    } | Sort-Object { $_.Substring(66) } | Set-Content -LiteralPath (Join-Path $Ctl 'world.sha256') -Encoding ascii
    Say ('Manifest written: {0} files' -f (Get-Content -LiteralPath (Join-Path $Ctl 'world.sha256')).Count)
  }
  'Backup' {
    # Java holds the region files open without sharing, so a running world cannot be copied: stop first.
    if (Get-ServerProc) { Say 'The server is running: its region files are locked. Stop it first (anu-world-server.ps1 Backup does stop, archive, start).'; exit 1 }
    New-Item -ItemType Directory -Force $Backups | Out-Null
    $dest = Join-Path $Backups ("world-{0}.tar.gz" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Say "Archiving $World -> $dest"
    & tar.exe -czf $dest --exclude=session.lock -C $Server $World
    if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $dest -ErrorAction SilentlyContinue; Say "Backup FAILED: tar exit $LASTEXITCODE"; exit 4 }
    Say ("Backup done: {0:n0} MB" -f ((Get-Item -LiteralPath $dest).Length / 1MB))
    Get-ChildItem -LiteralPath $Backups -Filter 'world-*.tar.gz' | Sort-Object Name -Descending | Select-Object -Skip $Keep | ForEach-Object { Say "Pruning $($_.Name)"; Remove-Item -LiteralPath $_.FullName }
  }
}
exit 0
