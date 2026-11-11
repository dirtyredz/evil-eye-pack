<#
.SYNOPSIS
  Dot-sourced by anu-world-server.ps1: Deploy (stage the pack's server files on Valhalla, ship, configure).
  Expects the caller's scope: $DryRun, $AnuHost, $AnuRoot, $Jobs, $PrivateCache, $HeapGb, $OpName, $OpUuid, $StageCli
  (path of tools/world_server/stage-world-server.cjs) plus the transport and owner-run helpers.
  Not an entry point: dot-sourced, no parameters of its own.
#>

function Invoke-Deploy {
  $stage = "$Jobs/$(Get-Date -Format 'yyyy-MM-dd')-anu-world-server/stage"
  Write-Log "Plan: stage the pack server files in $stage, tar, ship to ${AnuHost}:$AnuRoot (mods replaced, world/ctl/ops untouched), then Configure (heap ${HeapGb}G, op $OpName, LAN firewall rule)."
  if ($DryRun) { Complete-OwnerRun 0 }
  Send-Ctl
  if (Test-ServerRunning) { Complete-OwnerRun 1 'The server is running; run Stop first.' }
  $script:DeployRemoteChanged = $false
  $deployOk = $false
  try {
    $rc = Invoke-Native 'node' @($StageCli, '--out', $stage, '--private-cache', $PrivateCache)
    if ($rc -ne 0) { Complete-OwnerRun 3 'staging failed' }
    $tar = "$stage/../stage.tar"
    $rc = Invoke-Native (Get-WindowsTar) @('-cf', $tar, '-C', $stage, '.')
    if ($rc -ne 0) { Complete-OwnerRun 3 'tar failed' }
    Invoke-Ssh "New-Item -ItemType Directory -Force $AnuRoot\incoming | Out-Null"
    Send-ToAnu $tar "$AnuRoot\incoming\stage.tar" 'stage'
    # Invalidate previous evidence before replacement. Publish only after extraction + Configure succeed.
    $script:DeployRemoteChanged = $true
    Invoke-Ssh "`$ErrorActionPreference='Stop'; if (Test-Path -LiteralPath '$AnuRoot\ctl\deployed-mods.json') { Remove-Item -LiteralPath '$AnuRoot\ctl\deployed-mods.json' -Force }; foreach (`$d in 'mods','config','kubejs','libraries') { if (Test-Path $AnuRoot\`$d) { Remove-Item -Recurse -Force $AnuRoot\`$d } }; & `"`$env:SystemRoot\System32\tar.exe`" -xf $AnuRoot\incoming\stage.tar -C $AnuRoot; if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }; Remove-Item $AnuRoot\incoming\stage.tar"
    Invoke-Ctl "-Op Configure -HeapGb $HeapGb -OpUuid $OpUuid -OpName $OpName"
    Invoke-Ssh "Copy-Item -LiteralPath '$AnuRoot\world-server-stage.json' -Destination '$AnuRoot\ctl\deployed-mods.json' -Force -ErrorAction Stop"
    $deployOk = $true
  } finally {
    # Complete-OwnerRun exits the script and finally still runs on exit: a failed Deploy must not leave the server down.
    if (-not $deployOk) { Restart-AfterFailedDeploy }
  }
}

# Deploy refuses to run while the server is up, so any failure leaves it stopped. Start it again unless the files on
# ANU were already replaced: a half-extracted mods folder would boot the world against the wrong mod set.
function Restart-AfterFailedDeploy {
  if ($script:DeployRemoteChanged) {
    Write-Log 'Deploy failed after the server files on ANU were replaced; NOT restarting (half-deployed mods). Re-run Deploy, then Start.'
    return
  }
  Write-Log 'Deploy failed before the server files on ANU changed; starting the server again (it was stopped for this Deploy).'
  $rc = Invoke-Native 'ssh' @($AnuHost, "powershell -NoProfile -ExecutionPolicy Bypass -File $Ctl -Op Start")
  if ($rc -eq 0) { Write-Log 'Server restarted after the failed Deploy.' } else { Write-Log "WARNING: restart after failed Deploy failed (exit $rc); run Start manually." }
}
