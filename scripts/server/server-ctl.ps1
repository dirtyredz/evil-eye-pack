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

. (Join-Path $PSScriptRoot 'server-process.ps1')
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
  'Start' { exit (Invoke-ServerStart -TimeoutSec $TimeoutSec -Priority $Priority) }
  'Stop' { exit (Invoke-ServerStop -TimeoutSec $TimeoutSec) }
  'Status' { exit (Invoke-ServerStatus) }
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
