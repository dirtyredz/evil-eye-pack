<#
.SYNOPSIS
Prepare Evil Eye NeoForge Trial using verified local jars, then launch it yourself.
.DESCRIPTION
Works from any directory; resolves the checkout from PSScriptRoot. Packwiz copies
hash-verified cached jars as ordinary files from a temporary local pack. No host,
downloads or client launch. Sets only Trial's prelaunch to repeat this install.
Logs under .tmp/owner-runs and ends with OK/FAILED. Exit 1: Node missing; 2: failure.
.PARAMETER DryRun
Verify the pack and all cached bytes without installing or changing the instance.
.PARAMETER Cache
Complete offline migration cache root (mods, resourcepacks and shaderpacks).
.EXAMPLE
.\scripts\migration\trial-walkthrough.ps1 -DryRun
.EXAMPLE
.\scripts\migration\trial-walkthrough.ps1
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [string]$Cache = 'C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-world-trial-final/cache'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
Initialize-OwnerRun 'trial-walkthrough'
try {
  $node = Find-Tool 'node'
  if (-not $node) { Complete-OwnerRun 1 'Node 22 is required.' }
  $arguments = @((Join-Path $script:RepoRoot 'tools/packwiz/install/trial_target.cjs'), '--cache', $Cache)
  if ($DryRun) { $arguments += '--dry-run' }
  $code = Invoke-Native $node $arguments $script:RepoRoot
  if ($code -ne 0) { Complete-OwnerRun 2 "Trial preparation failed (Node exit $code)." }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 2 $_.Exception.Message }
