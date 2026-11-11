<#
.SYNOPSIS
Create, repair or refresh Evil Eye Local: a save-free copy of Stable that installs the main checkout.
.DESCRIPTION
Works from any directory (the checkout is resolved from PSScriptRoot). Local takes Stable's
loader/Minecraft/Java/JVM settings (read only) and installs this checkout's pack through the
verified-cache route (packwiz copies hash-checked cached jars as ordinary files; no host, no
downloads). Never writes to Stable, never copies saves, never starts the game.
  -Create  builds a new Local from Stable's instance files; refuses if Local already exists
           (move the old one away first, MultiMC closed).
  default  installs into Local and sets its PreLaunchCommand to this script (main checkout path),
           so each launch repeats the install. MultiMC runs it that way.
Logs under .tmp/owner-runs and ends with OK/FAILED. Exit 1: Node missing; 2: failure.
.PARAMETER Create
Build the Local instance folder first, then install.
.PARAMETER DryRun
Verify the pack and cached bytes (and, with -Create, report what would be built); change nothing.
.PARAMETER Cache
Complete offline cache root (mods, resourcepacks, shaderpacks). Default: Stable's cache.
.EXAMPLE
.\scripts\instances\local-instance.ps1 -Create -DryRun
.EXAMPLE
.\scripts\instances\local-instance.ps1 -Create
#>
[CmdletBinding()]
param(
  [switch]$Create,
  [switch]$DryRun,
  [string]$Cache = 'C:/Users/dirty/.local-state/evil-eye-pack/artifacts/jobs/2026-10-31-world-trial-final/cache'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
Initialize-OwnerRun 'local-instance'
try {
  $node = Find-Tool 'node'
  if (-not $node) { Complete-OwnerRun 1 'Node 22 is required.' }
  $arguments = @((Join-Path $script:RepoRoot 'tools/packwiz/install/local_target.cjs'), '--cache', $Cache)
  if ($Create) { $arguments += '--create' }
  if ($DryRun) { $arguments += '--dry-run' }
  $code = Invoke-Native $node $arguments $script:RepoRoot
  if ($code -ne 0) { Complete-OwnerRun 2 "Local instance step failed (Node exit $code)." }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 2 $_.Exception.Message }
