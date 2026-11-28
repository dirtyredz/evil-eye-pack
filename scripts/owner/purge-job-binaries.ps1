<#
.SYNOPSIS
Delete binary/cache files under the job artifacts folder, never touching a folder that holds a KEEP-LIVE marker.
.DESCRIPTION
Replaces the old purge-job-binaries.cmd. Any directory (and everything below it) containing a file whose
name starts with KEEP-LIVE is skipped; the 2026-11-19 purge emptied Stable's live install cache
(jobs/2026-10-31-world-trial-final/cache) because the old script had no guard. Empty directories are removed
afterwards, except those under a KEEP-LIVE folder.
.PARAMETER Root
Jobs folder to purge. Default: the evil-eye-pack artifacts/jobs state folder.
.PARAMETER DryRun
List what would be deleted without deleting.
.EXAMPLE
.\scripts\owner\purge-job-binaries.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [string]$Root = 'C:/Users/dirty/.local-state/evil-eye-pack/artifacts/jobs',
  [switch]$DryRun
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'owner-run.ps1')
Initialize-OwnerRun 'purge-job-binaries'
try {
  if (-not (Test-Path -LiteralPath $Root)) { Complete-OwnerRun 1 "Jobs folder not found: $Root" }
  $Root = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')
  $keep = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Filter 'KEEP-LIVE*' -Force | ForEach-Object { $_.DirectoryName.TrimEnd('\') + '\' })
  function Test-Protected([string]$Path) {
    foreach ($k in $keep) { if (($Path + '\').StartsWith($k, [StringComparison]::OrdinalIgnoreCase)) { return $true } }
    return $false
  }
  $ext = 'jar','mca','mcc','dat','dat_old','zip','gz','lz4','nbt','dll','so','dylib','class','bin','db','sqlite','pak','cache','tmp'
  $files = Get-ChildItem -LiteralPath $Root -Recurse -File -Force | Where-Object { $ext -contains $_.Extension.TrimStart('.').ToLower() -and -not (Test-Protected $_.DirectoryName) }
  Write-Log "KEEP-LIVE folders skipped: $($keep.Count)"
  Write-Log "Files to delete: $(@($files).Count)"
  if (-not $DryRun) {
    $files | Remove-Item -Force
    Get-ChildItem -LiteralPath $Root -Recurse -Directory -Force | Sort-Object { $_.FullName.Length } -Descending |
      Where-Object { -not (Test-Protected $_.FullName) -and -not (Get-ChildItem -LiteralPath $_.FullName -Force) } |
      Remove-Item -Force
  }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 1 $_.Exception.Message }
