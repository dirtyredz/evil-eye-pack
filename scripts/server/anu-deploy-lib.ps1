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
  $rc = Invoke-Native 'node' @($StageCli, '--out', $stage, '--private-cache', $PrivateCache)
  if ($rc -ne 0) { Complete-OwnerRun 3 'staging failed' }
  $tar = "$stage/../stage.tar"
  $rc = Invoke-Native 'tar' @('-cf', $tar, '-C', $stage, '.')
  if ($rc -ne 0) { Complete-OwnerRun 3 'tar failed' }
  Invoke-Ssh "New-Item -ItemType Directory -Force $AnuRoot\incoming | Out-Null"
  Send-ToAnu $tar "$AnuRoot\incoming\stage.tar" 'stage'
  Invoke-Ssh "foreach (`$d in 'mods','config','kubejs','libraries') { if (Test-Path $AnuRoot\`$d) { Remove-Item -Recurse -Force $AnuRoot\`$d } }; tar -xf $AnuRoot\incoming\stage.tar -C $AnuRoot; Remove-Item $AnuRoot\incoming\stage.tar"
  Invoke-Ctl "-Op Configure -HeapGb $HeapGb -OpUuid $OpUuid -OpName $OpName"
}
