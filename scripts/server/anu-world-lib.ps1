<#
.SYNOPSIS
  Dot-sourced by anu-world-server.ps1: CopyWorld (copy a stopped singleplayer world to ANU, hash-verify every
  file, check the host player's data) and the world backup actions (Backup, Pull).
  Expects the caller's scope: $DryRun, $AnuHost, $AnuRoot, $AnuBackup, $AnuCtl, $Jobs, $SourceWorld, $ReplaceWorld,
  $OpUuid, $OutDir, $PlayerCheck (path of player-data-check.cjs) plus the transport and owner-run helpers.
  Not an entry point: dot-sourced, no parameters of its own.
#>

function Test-ValhallaGameRunning {
  @(Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -match 'Evil Eye|MultiMC|net\.minecraft|neoforge' })
}
# NOTE: server-ctl.ps1 -Op Manifest produces the same format on ANU; the two must stay identical (Docket: one portable module).
function Get-LocalManifest([string]$Root) {
  Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object { $_.Name -ne 'session.lock' } | ForEach-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\', '/')
    '{0}  ./{1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower(), $rel
  } | Sort-Object { $_.Substring(66) }
}

function Invoke-CopyWorld {
  $game = @(Test-ValhallaGameRunning)
  foreach ($g in $game) { Write-Log ("  running: pid {0} {1}" -f $g.ProcessId, $g.Name) }
  if ($game.Count -gt 0) { Complete-OwnerRun 1 'An Evil Eye / Minecraft java process is running on Valhalla. Quit to title or close the game first.' }
  if (-not (Test-Path -LiteralPath (Join-Path $SourceWorld 'level.dat'))) { Complete-OwnerRun 1 "No level.dat in $SourceWorld" }
  Write-Log "Plan: tar $SourceWorld (read only) -> ${AnuHost}:$AnuRoot\evil-eye-world, then compare sha256 of every file. The original is never modified."
  if ($DryRun) { Complete-OwnerRun 0 }
  Send-Ctl
  if (Test-ServerRunning) { Complete-OwnerRun 1 'The server is running; run Stop first.' }
  $exists = (Invoke-SshQuery "Test-Path $AnuRoot\evil-eye-world").Output.Trim()
  if ($exists -eq 'True') {
    if (-not $ReplaceWorld) { Complete-OwnerRun 1 'ANU already has evil-eye-world (the live world). Use -ReplaceWorld to move it aside and copy again.' }
    Invoke-Ssh "Rename-Item $AnuRoot\evil-eye-world evil-eye-world.replaced-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  }
  $job = "$Jobs/$(Get-Date -Format 'yyyy-MM-dd')-anu-world-server"
  New-Item -ItemType Directory -Force $job | Out-Null
  $src = (Get-LocalManifest $SourceWorld)
  Set-Content -LiteralPath "$job/source-world.sha256" -Value $src -Encoding ascii
  Write-Log "Source manifest: $(@($src).Count) files"
  $rc = Invoke-Native (Get-WindowsTar) @('-cf', "$job/world.tar", '--exclude=session.lock', '-C', $SourceWorld, '.')
  if ($rc -ne 0) { Complete-OwnerRun 3 'tar failed' }
  Invoke-Ssh "New-Item -ItemType Directory -Force $AnuRoot\incoming, $AnuRoot\evil-eye-world | Out-Null"
  Send-ToAnu "$job/world.tar" "$AnuRoot\incoming\world.tar" 'world'
  Invoke-Ssh "& `"`$env:SystemRoot\System32\tar.exe`" -xf$AnuRoot\incoming\world.tar -C $AnuRoot\evil-eye-world; Remove-Item $AnuRoot\incoming\world.tar"
  Invoke-Ctl '-Op Manifest'
  Get-FromAnu "$AnuCtl\world.sha256" "$job/dest-world.sha256" 'manifest'
  $diff = Compare-Object @($src) @(Get-Content "$job/dest-world.sha256")
  if ($diff) { Complete-OwnerRun 3 ("Hash mismatch on {0} entries; first: {1}" -f @($diff).Count, $diff[0].InputObject) }
  Write-Log "Hash-verified: $(@($src).Count) files identical on ANU."
  # Player data check (see the dispatcher's .DESCRIPTION): is playerdata/<uuid>.dat present and identical to level.dat's Player tag?
  $r = Invoke-NativeCapture { & node $PlayerCheck $SourceWorld $OpUuid 2>&1 }
  $chk = $r.Output
  $chkRc = $r.ExitCode
  Write-Log $chk.Trim()
  if ($chkRc -ne 0) { Write-Log 'WARNING: player data needs attention before the owner joins (see above).' }
}

function Invoke-Backup {
  if ($DryRun) { Write-Log "DryRun: would stop the server if running, archive evil-eye-world to $AnuBackup, then start it again"; Complete-OwnerRun 0 }
  Send-Ctl
  $wasRunning = Test-ServerRunning
  if ($wasRunning) { Invoke-Ctl '-Op Stop' }
  try { Invoke-Ctl '-Op Backup' 4 }
  finally { if ($wasRunning) { Write-Log 'Restarting the server'; Invoke-Ctl '-Op Start' 2 } }
}

function Invoke-Pull {
  $newest = (Invoke-SshQuery "(Get-ChildItem $AnuBackup -Filter 'world-*.tar.gz' | Sort-Object Name | Select-Object -Last 1).Name").Output.Trim()
  if (-not $newest) { Complete-OwnerRun 1 'No backup on ANU yet; run Backup first.' }
  Write-Log "Newest ANU backup: $newest -> $OutDir"
  if ($DryRun) { Complete-OwnerRun 0 }
  New-Item -ItemType Directory -Force $OutDir | Out-Null
  Get-FromAnu "$AnuBackup\$newest" (Join-Path $OutDir $newest) 'backup'
  Write-Log ("Pulled {0:n0} MB" -f ((Get-Item (Join-Path $OutDir $newest)).Length / 1MB))
}
