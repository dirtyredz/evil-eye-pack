<#
.SYNOPSIS
Roll the Evil Eye Stable instance back to the Forge archive made by cutover.ps1.
.DESCRIPTION
WITHOUT -Execute this is a dry run: it verifies the archive's hash manifest and the guards and
writes nothing outside <repo>/.tmp/owner-runs/. With -Execute (MultiMC and the game closed) it:
  1. re-hashes the whole archive against its manifest and stops if one byte differs (nothing touched);
  2. MOVES the live NeoForge .minecraft (possibly holding a converted world) into
     <ArchiveRoot>\cutover-rollback-<date-time>\ - it is never deleted and never downgraded in place;
  3. rebuilds the instance from the archive (saves, config, options.txt, mods, instance.cfg incl. the
     Forge Java 17 setting and original prelaunch, mmc-pack.json) and re-hashes the result.
Exit codes: 0 OK; 2 a guard refused, the archive failed verification, or restore differed;
3 bad parameters.
.PARAMETER Execute
Perform the rollback. Omit for a dry run (also available as the explicit -DryRun).
.PARAMETER DryRun
Explicit dry run (the default without -Execute). Wins over -Execute.
.PARAMETER Archive
The cutover-archive-<date-time> folder to restore. Default: the newest under -ArchiveRoot.
.PARAMETER Instance
Instance folder to restore into. Default: the real Evil Eye Stable.
.PARAMETER ArchiveRoot
Where archives and the rollback quarantine live. Default: C:/Users/dirty/projects/artifacts/evil-eye-pack.
.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File C:\path\to\checkout\scripts\migration\rollback.ps1 -Execute
#>
[CmdletBinding()]
param(
  [switch]$Execute,
  [switch]$DryRun,
  [string]$Archive,
  [string]$Instance,
  [string]$ArchiveRoot = 'C:/Users/dirty/projects/artifacts/evil-eye-pack'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
. (Join-Path $PSScriptRoot 'cutover-lib.ps1')
Initialize-OwnerRun 'rollback'
if (-not $Instance) { $Instance = Get-StableInstancePath }

$plan = -not $Execute -or $DryRun

try {
  Write-Log ("Rollback {0}: instance {1}" -f $(if ($plan) { 'DRY RUN (nothing will be written)' } else { 'EXECUTE' }), $Instance)
  $blockers = New-Object System.Collections.Generic.List[string]
  if (-not $Archive) {
    $latest = Get-ChildItem -LiteralPath $ArchiveRoot -Directory -Filter 'cutover-archive-*' -ErrorAction SilentlyContinue |
      Sort-Object Name | Select-Object -Last 1
    if ($latest) { $Archive = $latest.FullName } else { $blockers.Add("No cutover-archive-* folder under $ArchiveRoot") }
  }
  if ($Archive -and -not (Test-Path -LiteralPath (Join-Path $Archive 'manifest.sha256'))) { $blockers.Add("Not a cutover archive (no manifest.sha256): $Archive") }
  if (-not (Test-Path -LiteralPath $Instance -PathType Container)) { $blockers.Add("Instance folder not found: $Instance") }
  try { Assert-NotLocalOrTrial $Instance 'Rollback'; Assert-StableInstance $Instance 'Rollback' } catch { $blockers.Add($_.Exception.Message) }
  if (Test-RealStable $Instance) { foreach ($b in (Get-LauncherBlockers)) { $blockers.Add($b) } }
  else { Write-Log 'launcher check skipped: target is a rehearsal copy, not the real Stable instance' }

  if (-not $blockers.Count) {
    Write-Log "Verifying archive against its hash manifest: $Archive"
    $problems = @(Test-HashManifest (Join-Path $Archive 'files') (Join-Path $Archive 'manifest.sha256'))
    foreach ($p in ($problems | Select-Object -First 10)) { $blockers.Add("Archive: $p") }
    if (-not $problems.Count) { Write-Log '  archive verified: every file matches its SHA-256' }
  }
  foreach ($b in $blockers) { Write-Log "  BLOCKED: $b" }

  if ($plan) {
    if ($blockers.Count) { Write-Log ("NOT READY: {0} blocker(s)." -f $blockers.Count) }
    else {
      Write-Log 'READY. Would: move the live .minecraft to a cutover-rollback-<stamp> folder, restore the archive over the instance, re-verify every hash.'
    }
    Write-Log 'Dry run complete; nothing was written outside the owner-run log.'
    Complete-OwnerRun 0
  }
  if ($blockers.Count) { Complete-OwnerRun 2 ("Refusing: {0}" -f ($blockers -join '; ')) }

  $quarantine = Join-Path $ArchiveRoot ("cutover-rollback-" + (Get-Date -Format 'yyyy-MM-dd-HHmm'))
  if (Test-Path -LiteralPath $quarantine) { Complete-OwnerRun 2 "Quarantine folder already exists: $quarantine" }
  Write-Log "Moving the live NeoForge .minecraft aside to $quarantine and restoring the archive ..."
  $n = Restore-InstanceArchive $Archive $Instance $quarantine
  Write-Log "Restored $n files; every hash matches the manifest."
  Write-Log "The NeoForge folder (and any converted world) is kept at $quarantine. Do not load it with Forge."
  Write-Log 'Forge instance restored. Open MultiMC and launch Evil Eye (Stable).'
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 2 $_.Exception.Message }
