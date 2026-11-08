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
  Pull: destination folder on Valhalla. Default C:\Users\dirty\projects\artifacts\evil-eye-pack\world-backups.
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
  [string]$PrivateCache = 'C:\Users\dirty\projects\artifacts\evil-eye-pack\jobs\2026-10-31-world-trial-final\cache\mods',
  [int]$HeapGb = 10,
  [string]$OpName = 'DirtyRedz',
  [string]$OpUuid = '90486bf9-1855-4113-8ab9-35ef878c5a5c',
  [string]$OutDir = 'C:\Users\dirty\projects\artifacts\evil-eye-pack\world-backups',
  [string]$LauncherServersDat = 'C:\Users\dirty\MultiMC\instances\Evil Eye Stable\.minecraft\servers.dat',
  [string]$AnuHost = 'anu'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
Initialize-OwnerRun "anu-world-$($Action.ToLower())"

$AnuRoot   = 'G:\evil-eye-pack-ci\server'
$AnuCtl    = "$AnuRoot\ctl"
$AnuBackup = 'G:\evil-eye-pack-ci\server-backups'
$AnuAddr   = '192.168.1.251'
$Ctl       = "$AnuCtl\server-ctl.ps1"
$Jobs      = 'C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs'

function Invoke-Ssh([string]$Command, [int]$FailCode = 3) {
  $rc = Invoke-Native 'ssh' @($AnuHost, $Command)
  if ($rc -ne 0) { Complete-OwnerRun $FailCode "ssh command failed (exit $rc): $Command" }
}
function Invoke-Ctl([string]$CtlArgs, [int]$FailCode = 3) {
  Invoke-Ssh "powershell -NoProfile -ExecutionPolicy Bypass -File $Ctl $CtlArgs" $FailCode
}
function Send-Ctl {
  if ($DryRun) { Write-Log "DryRun: would copy server-ctl.ps1 and mc-net.cjs to ${AnuHost}:$AnuCtl"; return }
  Invoke-Ssh "New-Item -ItemType Directory -Force $AnuCtl | Out-Null"
  foreach ($f in 'server-ctl.ps1', 'mc-net.cjs') {
    $rc = Invoke-Native 'scp' @('-q', (Join-Path $PSScriptRoot $f), "${AnuHost}:$($AnuCtl.Replace('\','/'))/$f")
    if ($rc -ne 0) { Complete-OwnerRun 3 "scp $f failed (exit $rc)" }
  }
}
function Test-ValhallaGameRunning {
  @(Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'Evil Eye|MultiMC|net\.minecraft|neoforge' })
}
function Get-LocalManifest([string]$Root) {
  Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object { $_.Name -ne 'session.lock' } | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    '{0}  ./{1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower(), $rel
  } | Sort-Object { $_.Substring(66) }
}
function Test-ServerRunning {
  $out = & ssh $AnuHost "powershell -NoProfile -ExecutionPolicy Bypass -File $Ctl -Op Status" 2>&1 | Out-String
  return ($out -match 'State: RUNNING')
}

try {
  switch ($Action) {
    'Status' {
      Send-Ctl
      Invoke-Ctl '-Op Status'
      $ping = & node (Join-Path $PSScriptRoot 'mc-net.cjs') ping $AnuAddr 25565 2>&1 | Out-String
      Write-Log ("Ping from Valhalla to {0}:25565 -> {1}" -f $AnuAddr, $ping.Trim())
      if ($LASTEXITCODE -ne 0) { Complete-OwnerRun 2 'server list ping failed' }
    }
    'Start' {
      if ($DryRun) { Write-Log 'DryRun: would start the server on ANU and wait for Done'; Complete-OwnerRun 0 }
      Send-Ctl
      Invoke-Ctl '-Op Start' 2
      $ping = & node (Join-Path $PSScriptRoot 'mc-net.cjs') ping $AnuAddr 25565 2>&1 | Out-String
      Write-Log ("Ping from Valhalla -> {0}" -f $ping.Trim())
      if ($LASTEXITCODE -ne 0) { Complete-OwnerRun 2 'server list ping failed' }
    }
    'Stop' {
      if ($DryRun) { Write-Log 'DryRun: would save-all flush and stop the server'; Complete-OwnerRun 0 }
      Send-Ctl
      Invoke-Ctl '-Op Stop'
    }
    'Backup' {
      if ($DryRun) { Write-Log "DryRun: would stop the server if running, archive evil-eye-world to $AnuBackup, then start it again"; Complete-OwnerRun 0 }
      Send-Ctl
      $wasRunning = Test-ServerRunning
      if ($wasRunning) { Invoke-Ctl '-Op Stop' }
      try { Invoke-Ctl '-Op Backup' 4 }
      finally { if ($wasRunning) { Write-Log 'Restarting the server'; Invoke-Ctl '-Op Start' 2 } }
    }
    'Pull' {
      $newest = (& ssh $AnuHost "(Get-ChildItem $AnuBackup -Filter 'world-*.tar.gz' | Sort-Object Name | Select-Object -Last 1).Name" | Out-String).Trim()
      if (-not $newest) { Complete-OwnerRun 1 'No backup on ANU yet; run Backup first.' }
      Write-Log "Newest ANU backup: $newest -> $OutDir"
      if ($DryRun) { Complete-OwnerRun 0 }
      New-Item -ItemType Directory -Force $OutDir | Out-Null
      $rc = Invoke-Native 'scp' @('-q', "${AnuHost}:$($AnuBackup.Replace('\','/'))/$newest", (Join-Path $OutDir $newest))
      if ($rc -ne 0) { Complete-OwnerRun 3 "scp failed (exit $rc)" }
      Write-Log ("Pulled {0:n0} MB" -f ((Get-Item (Join-Path $OutDir $newest)).Length / 1MB))
    }
    'Deploy' {
      $stage = "$Jobs/$(Get-Date -Format 'yyyy-MM-dd')-anu-world-server/stage"
      Write-Log "Plan: stage the pack server files in $stage, tar, ship to ${AnuHost}:$AnuRoot (mods replaced, world/ctl/ops untouched), then Configure (heap ${HeapGb}G, op $OpName, LAN firewall rule)."
      if ($DryRun) { Complete-OwnerRun 0 }
      Send-Ctl
      if (Test-ServerRunning) { Complete-OwnerRun 1 'The server is running; run Stop first.' }
      $rc = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'stage-world-server.cjs'), '--out', $stage, '--private-cache', $PrivateCache)
      if ($rc -ne 0) { Complete-OwnerRun 3 'staging failed' }
      $tar = "$stage/../stage.tar"
      $rc = Invoke-Native 'tar' @('-cf', $tar, '-C', $stage, '.')
      if ($rc -ne 0) { Complete-OwnerRun 3 'tar failed' }
      Invoke-Ssh "New-Item -ItemType Directory -Force $AnuRoot\incoming | Out-Null"
      $rc = Invoke-Native 'scp' @('-q', $tar, "${AnuHost}:$($AnuRoot.Replace('\','/'))/incoming/stage.tar")
      if ($rc -ne 0) { Complete-OwnerRun 3 'scp stage failed' }
      Invoke-Ssh "foreach (`$d in 'mods','config','kubejs','libraries') { if (Test-Path $AnuRoot\`$d) { Remove-Item -Recurse -Force $AnuRoot\`$d } }; tar -xf $AnuRoot\incoming\stage.tar -C $AnuRoot; Remove-Item $AnuRoot\incoming\stage.tar"
      Invoke-Ctl "-Op Configure -HeapGb $HeapGb -OpUuid $OpUuid -OpName $OpName"
    }
    'CopyWorld' {
      $game = @(Test-ValhallaGameRunning)
      foreach ($g in $game) { Write-Log ("  running: pid {0} {1}" -f $g.ProcessId, $g.Name) }
      if ($game.Count -gt 0) { Complete-OwnerRun 1 'An Evil Eye / Minecraft java process is running on Valhalla. Quit to title or close the game first.' }
      if (-not (Test-Path -LiteralPath (Join-Path $SourceWorld 'level.dat'))) { Complete-OwnerRun 1 "No level.dat in $SourceWorld" }
      Write-Log "Plan: tar $SourceWorld (read only) -> ${AnuHost}:$AnuRoot\evil-eye-world, then compare sha256 of every file. The original is never modified."
      if ($DryRun) { Complete-OwnerRun 0 }
      Send-Ctl
      if (Test-ServerRunning) { Complete-OwnerRun 1 'The server is running; run Stop first.' }
      $exists = (& ssh $AnuHost "Test-Path $AnuRoot\evil-eye-world" | Out-String).Trim()
      if ($exists -eq 'True') {
        if (-not $ReplaceWorld) { Complete-OwnerRun 1 'ANU already has evil-eye-world (the live world). Use -ReplaceWorld to move it aside and copy again.' }
        Invoke-Ssh "Rename-Item $AnuRoot\evil-eye-world evil-eye-world.replaced-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
      }
      $job = "$Jobs/$(Get-Date -Format 'yyyy-MM-dd')-anu-world-server"
      New-Item -ItemType Directory -Force $job | Out-Null
      $src = (Get-LocalManifest $SourceWorld)
      Set-Content -LiteralPath "$job/source-world.sha256" -Value $src -Encoding ascii
      Write-Log "Source manifest: $(@($src).Count) files"
      $rc = Invoke-Native 'tar' @('-cf', "$job/world.tar", '--exclude=session.lock', '-C', $SourceWorld, '.')
      if ($rc -ne 0) { Complete-OwnerRun 3 'tar failed' }
      Invoke-Ssh "New-Item -ItemType Directory -Force $AnuRoot\incoming, $AnuRoot\evil-eye-world | Out-Null"
      $rc = Invoke-Native 'scp' @('-q', "$job/world.tar", "${AnuHost}:$($AnuRoot.Replace('\','/'))/incoming/world.tar")
      if ($rc -ne 0) { Complete-OwnerRun 3 'scp world failed' }
      Invoke-Ssh "tar -xf $AnuRoot\incoming\world.tar -C $AnuRoot\evil-eye-world; Remove-Item $AnuRoot\incoming\world.tar"
      Invoke-Ctl '-Op Manifest'
      $rc = Invoke-Native 'scp' @('-q', "${AnuHost}:$($AnuCtl.Replace('\','/'))/world.sha256", "$job/dest-world.sha256")
      if ($rc -ne 0) { Complete-OwnerRun 3 'scp manifest failed' }
      $diff = Compare-Object @($src) @(Get-Content "$job/dest-world.sha256")
      if ($diff) { Complete-OwnerRun 3 ("Hash mismatch on {0} entries; first: {1}" -f @($diff).Count, $diff[0].InputObject) }
      Write-Log "Hash-verified: $(@($src).Count) files identical on ANU."
      # Player data check (see .DESCRIPTION): is playerdata/<uuid>.dat present and identical to level.dat's Player tag?
      $chk = & node (Join-Path $PSScriptRoot 'player-data-check.cjs') $SourceWorld $OpUuid 2>&1 | Out-String
      Write-Log $chk.Trim()
      if ($LASTEXITCODE -ne 0) { Write-Log 'WARNING: player data needs attention before the owner joins (see above).' }
    }
    'AddLauncherEntry' {
      $nodeArgs = @((Join-Path $PSScriptRoot 'add-server-entry.cjs'), $LauncherServersDat, 'Evil Eye (ANU)', $AnuAddr)
      if ($DryRun) { $nodeArgs += '--dry-run' }
      $rc = Invoke-Native 'node' $nodeArgs
      if ($rc -ne 0) { Complete-OwnerRun 3 'servers.dat edit failed' }
    }
  }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 3 $_.Exception.Message }
