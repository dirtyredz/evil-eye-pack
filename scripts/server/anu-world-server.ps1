<#
.SYNOPSIS
  Run the owner's Evil Eye world as a dedicated server on ANU (LAN only) and manage it from Valhalla.
.DESCRIPTION
  The server lives in G:\evil-eye-pack-ci\server on ANU (NeoForge 21.1.265, MC 1.21.1, Java 21, world folder
  evil-eye-world, port 25565, online-mode). Every action runs from Valhalla over ssh and logs to
  <repo>\.tmp\owner-runs\. Runs from any directory; the repo is found from $PSScriptRoot.

  Actions:
    Status       State, uptime, RAM, players, log error/"Can't keep up" counts, newest backup, plus a server
                 list ping from Valhalla. Read-only.
    Start        Start the server detached (survives ssh), wait for "Done". Idempotent.
    Stop         Graceful stop (RCON save-all flush + stop), forced kill only after the timeout.
    Backup       Archive the world to G:\evil-eye-pack-ci\server-backups\ (tar.gz, newest 8 kept). Java locks the region
                 files, so a running server is stopped, archived and started again (about 3 minutes offline).
    Pull         Copy the newest ANU backup to Valhalla (-OutDir) so the world exists off ANU too.
    Deploy       Rebuild the server files from this checkout's pack (packwiz -s server, server-side mods only),
                 ship them to ANU and write server.properties / JVM args / ops / firewall. Keeps the world.
                 Refuses while the server runs.
    CopyWorld    COPY a stopped singleplayer world to ANU (never moves or modifies the original) and
                 hash-verify every file. Refuses if any Evil Eye java/javaw is running on Valhalla, or if the
                 ANU world already exists (-ReplaceWorld renames it aside first).
    AddLauncherEntry  Add "Evil Eye (ANU)" to Evil Eye Stable's servers.dat (backup made first).

  SINGLEPLAYER -> DEDICATED: the host player's inventory, Curios, backpack and position live in level.dat's
  Player tag and (in 1.21.1) are also written to playerdata/<uuid>.dat on every save. A dedicated server only
  reads playerdata/<uuid>.dat. CopyWorld compares the two and warns if the .dat is missing or differs; on the
  2026-11-07 copy they were identical, so nothing was rewritten.

  Exit codes: 0 ok / dry-run; 1 precondition failed (game running, world exists, bad arguments);
  2 server did not start / ping failed; 3 a copy, hash or ssh step failed; 4 backup failed.
.PARAMETER Action
  Status | Start | Stop | Backup | Pull | Deploy | CopyWorld | AddLauncherEntry.
.PARAMETER DryRun
  Describe what would happen; run nothing that changes state (Status still reads).
.PARAMETER SourceWorld
  CopyWorld: the stopped world folder. Default Evil Eye Stable's saves\New World.
.PARAMETER ReplaceWorld
  CopyWorld: move an existing ANU world aside (evil-eye-world.replaced-<stamp>) and copy again.
.PARAMETER PrivateCache
  Deploy: folder of <sha256>.jar private pins (Evil Eye jars). Default the world-trial-final cache\mods.
.PARAMETER HeapGb
  Deploy: server max heap in GB. Default 10.
.PARAMETER OpName
  Deploy: player to op. Default DirtyRedz.
.PARAMETER OpUuid
  Deploy: that player's UUID. Default 90486bf9-1855-4113-8ab9-35ef878c5a5c.
.PARAMETER OutDir
  Pull: destination folder on Valhalla. Default env FIXED.ARTIFACTS/world-backups.
.PARAMETER LauncherServersDat
  AddLauncherEntry: servers.dat to edit. Default Evil Eye Stable's.
.PARAMETER AnuHost
  ssh alias for ANU. Default anu. The server address clients use is 192.168.1.251:25565.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory, Position = 0)][ValidateSet('Status','Start','Stop','Backup','Pull','Deploy','CopyWorld','AddLauncherEntry')][string]$Action,
  [switch]$DryRun,
  [string]$SourceWorld = 'C:\Users\dirty\MultiMC\instances\Evil Eye Stable\.minecraft\saves\New World',
  [switch]$ReplaceWorld,
  [string]$PrivateCache,
  [int]$HeapGb = 10,
  [string]$OpName = 'DirtyRedz',
  [string]$OpUuid = '90486bf9-1855-4113-8ab9-35ef878c5a5c',
  [string]$OutDir,
  [string]$LauncherServersDat = 'C:\Users\dirty\MultiMC\instances\Evil Eye Stable\.minecraft\servers.dat',
  [string]$AnuHost = 'anu'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
. (Join-Path $PSScriptRoot '../../tools/runtime_env/paths.ps1')
Initialize-OwnerRun "anu-world-$($Action.ToLower())"

$AnuRoot   = 'G:\evil-eye-pack-ci\server'
$AnuCtl    = "$AnuRoot\ctl"
$AnuBackup = 'G:\evil-eye-pack-ci\server-backups'
$AnuAddr   = '192.168.1.251'
$Ctl       = "$AnuCtl\server-ctl.ps1"
$Jobs      = $null
# Node helpers live under tools/world_server (shared with ANU: mc-net.cjs is shipped there by Send-Ctl).
$WorldTools  = Join-Path $PSScriptRoot '../../tools/world_server'
$McNet       = Join-Path $WorldTools 'mc-net.cjs'
$StageCli    = Join-Path $WorldTools 'stage-world-server.cjs'
$PlayerCheck = Join-Path $WorldTools 'player-data-check.cjs'
$AddEntry    = Join-Path $WorldTools 'add-server-entry.cjs'

# Transport (ssh/scp, remote controller, ping), Deploy, and world copy/backup live in dot-sourced modules.
. (Join-Path $PSScriptRoot 'anu-transport-lib.ps1')
. (Join-Path $PSScriptRoot 'anu-deploy-lib.ps1')
. (Join-Path $PSScriptRoot 'anu-world-lib.ps1')

try {
  $Jobs = Get-RuntimePath 'FIXED.ARTIFACT_JOBS'
  if (-not $PrivateCache) { $PrivateCache = Join-Path (Get-RuntimePath 'FIXED.STABLE_CACHE') 'mods' }
  if (-not $OutDir) { $OutDir = Join-Path (Get-RuntimePath 'FIXED.ARTIFACTS') 'world-backups' }
  switch ($Action) {
    'Status' {
      Send-Ctl
      Invoke-Ctl '-Op Status'
      Test-ServerPing
    }
    'Start' {
      if ($DryRun) { Write-Log 'DryRun: would start the server on ANU and wait for Done'; Complete-OwnerRun 0 }
      Send-Ctl
      Invoke-Ctl '-Op Start' 2
      Test-ServerPing
    }
    'Stop' {
      if ($DryRun) { Write-Log 'DryRun: would save-all flush and stop the server'; Complete-OwnerRun 0 }
      Send-Ctl
      Invoke-Ctl '-Op Stop'
    }
    'Backup'    { Invoke-Backup }
    'Pull'      { Invoke-Pull }
    'Deploy'    { Invoke-Deploy }
    'CopyWorld' { Invoke-CopyWorld }
    'AddLauncherEntry' {
      $nodeArgs = @($AddEntry, $LauncherServersDat, 'Evil Eye (ANU)', $AnuAddr)
      if ($DryRun) { $nodeArgs += '--dry-run' }
      $rc = Invoke-Native 'node' $nodeArgs
      if ($rc -ne 0) { Complete-OwnerRun 3 'servers.dat edit failed' }
    }
  }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 3 $_.Exception.Message }
