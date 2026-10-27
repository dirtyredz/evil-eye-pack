<#
.SYNOPSIS
Build the offline Evil Eye mod map with one headless server boot, or saved evidence.
.DESCRIPTION
Works from any directory. Uses pinned cached jars only, writes a self-contained
latest and timestamped HTML under the artifacts root, and logs in .tmp/owner-runs.
Exit codes: 0 success/dry-run, 1 missing Node, 2 failed build.
.PARAMETER DryRun
Validate jar inputs and describe the run without booting or writing artifacts.
.PARAMETER Evidence
Reuse a prior mod-map run directory with matching pins and index; no new boot.
.PARAMETER World
Cached world folder (containing level.dat) to copy if the exact mod-set cache is absent.
.PARAMETER Out
Output directory under the configured artifacts root.
.PARAMETER Mods
Read-only installed mods folder; the server cache is also searched.
.PARAMETER Cache
Read-only prepared pack-test server cache.
#>
[CmdletBinding()]
param([switch]$DryRun, [string]$Evidence, [string]$World, [string]$Out, [string]$Mods, [string]$Cache)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
Initialize-OwnerRun 'mod-map'
try {
  $node = Find-Tool 'node'
  if (-not $node) { Complete-OwnerRun 1 'Node 22 is required.' }
  $arguments = @((Join-Path $script:RepoRoot 'tools/mod_map/build.mjs'))
  if ($DryRun) { $arguments += '--dry-run' }
  foreach ($pair in @(@('--evidence', $Evidence), @('--world', $World), @('--out', $Out), @('--mods', $Mods), @('--cache', $Cache))) {
    if ($pair[1]) { $arguments += $pair }
  }
  $code = Invoke-Native $node $arguments $script:RepoRoot
  if ($code -ne 0) { Complete-OwnerRun 2 "Mod map failed (Node exit $code)." }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 2 $_.Exception.Message }
