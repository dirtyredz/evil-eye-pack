<#
.SYNOPSIS
Repeat the verified private-jar install into Evil Eye Stable on every launch (post-cutover prelaunch).
.DESCRIPTION
Set as Stable's PreLaunchCommand by cutover.ps1. Uses the neutral install route (stable_target.cjs, which enforces instance_targets.cjs): packwiz copies
hash-verified cached jars as ordinary files; no host, no downloads. Runs from the checkout that
contains this script (resolved from PSScriptRoot). Logs under .tmp/owner-runs and ends OK/FAILED.
Exit 1: Node missing; 2: install failed.
.PARAMETER Cache
Complete offline migration cache root (mods, resourcepacks and shaderpacks).
.PARAMETER Instance
Override the target .minecraft folder (rehearsals on a copy only). Default: the real Stable instance.
.PARAMETER DryRun
Verify the pack and cached bytes without installing or changing anything.
.EXAMPLE
.\scripts\migration\stable-prelaunch.ps1 -Cache C:/path/to/cache -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$Cache,
  [string]$Instance,
  [switch]$DryRun
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
Initialize-OwnerRun 'stable-prelaunch'
try {
  $node = Find-Tool 'node'
  if (-not $node) { Complete-OwnerRun 1 'Node 22 is required.' }
  $arguments = @((Join-Path $script:RepoRoot 'tools/packwiz/install/stable_target.cjs'), '--cache', $Cache)
  if ($Instance) { $arguments += @('--instance', $Instance) }
  if ($DryRun) { $arguments += '--dry-run' }
  $code = Invoke-Native $node $arguments $script:RepoRoot
  if ($code -ne 0) { Complete-OwnerRun 2 "Stable install failed (Node exit $code)." }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 2 $_.Exception.Message }
