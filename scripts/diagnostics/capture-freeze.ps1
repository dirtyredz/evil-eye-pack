<#
.SYNOPSIS
Capture two jstack thread dumps (10 s apart) of a hung Evil Eye Stable client.
.DESCRIPTION
Finds the java/javaw process whose command line names the "Evil Eye Stable" instance, then runs
jstack -l twice, 10 seconds apart, so a stuck render thread shows as identical frames in both.
Dumps go to <artifacts>/jobs/<date>-freeze-dump/ (default
C:/Users/dirty/.local-state/evil-eye-pack/artifacts/jobs/<yyyy-MM-dd>-freeze-dump/), never into the repo.
Works from any directory; resolves the repo from $PSScriptRoot and logs to .tmp/owner-runs/.
Run it while the game is frozen (from another window, or over ssh). It only reads the JVM.
Exit codes: 0 success or dry-run, 1 jstack missing, 2 no Stable client process found,
3 a jstack call failed or wrote nothing.
.PARAMETER DryRun
Report the process found, the jstack path and the planned output files; run nothing, write nothing.
.PARAMETER InstanceName
Text that must appear in the java command line. Default "Evil Eye Stable".
.PARAMETER Jstack
Path to jstack.exe. Default C:\Users\dirty\.local-state\tools\evil-eye-pack\temurin-21\bin\jstack.exe.
.PARAMETER OutDir
Output directory. Default is the dated freeze-dump job folder under the artifacts root.
.PARAMETER IntervalSeconds
Seconds between the two dumps. Default 10.
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [string]$InstanceName = 'Evil Eye Stable',
  [string]$Jstack = 'C:\Users\dirty\.local-state\tools\evil-eye-pack\temurin-21\bin\jstack.exe',
  [string]$OutDir,
  [int]$IntervalSeconds = 10
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
Initialize-OwnerRun 'capture-freeze'
try {
  if (-not $OutDir) {
    $OutDir = 'C:/Users/dirty/.local-state/evil-eye-pack/artifacts/jobs/{0}-freeze-dump' -f (Get-Date -Format 'yyyy-MM-dd')
  }
  if (-not (Test-Path -LiteralPath $Jstack)) { Complete-OwnerRun 1 "jstack not found: $Jstack" }

  $needle = $InstanceName.Replace('\', '/')
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='java.exe' OR Name='javaw.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\', '/').Contains($needle) })
  Write-Log ("Matching java processes for '{0}': {1}" -f $InstanceName, $procs.Count)
  foreach ($p in $procs) { Write-Log ("  PID {0} {1}" -f $p.ProcessId, $p.Name) }
  if ($procs.Count -eq 0) {
    if ($DryRun) {
      Write-Log 'DryRun: no client running right now (expected unless the game is up). Nothing else to do.'
    } else {
      Complete-OwnerRun 2 "No java process with '$InstanceName' in its command line."
    }
  }
  if ($procs.Count -gt 1) { Write-Log 'Several matches; using the one with the largest working set.' }
  $target = $procs | Sort-Object { (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue).WorkingSet64 } -Descending | Select-Object -First 1
  $targetPid = if ($target) { $target.ProcessId } else { '<pid>' }

  $stamp = Get-Date -Format 'HHmmss'
  $files = @("$OutDir/jstack-$targetPid-$stamp-1.txt", "$OutDir/jstack-$targetPid-$stamp-2.txt")
  Write-Log ("Plan: jstack -l {0} -> {1}, wait {2}s, then -> {3}" -f $targetPid, $files[0], $IntervalSeconds, $files[1])
  if ($DryRun) { Complete-OwnerRun 0 }

  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
  for ($i = 0; $i -lt 2; $i++) {
    if ($i -gt 0) { Start-Sleep -Seconds $IntervalSeconds }
    Write-Log ("Dump {0} of 2 -> {1}" -f ($i + 1), $files[$i])
    # Redirect stdout to the dump and stderr to a side file; the exit code comes from -PassThru.
    $proc = Start-Process -FilePath $Jstack -ArgumentList @('-l', "$targetPid") -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $files[$i] -RedirectStandardError "$($files[$i]).err"
    $size = (Get-Item -LiteralPath $files[$i]).Length
    if ($proc.ExitCode -ne 0 -or $size -eq 0) {
      Complete-OwnerRun 3 ("jstack failed (exit {0}, {1} bytes); see {2}.err" -f $proc.ExitCode, $size, $files[$i])
    }
    Remove-Item -LiteralPath "$($files[$i]).err" -ErrorAction SilentlyContinue
    Write-Log ("  {0} bytes" -f $size)
  }
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 3 $_.Exception.Message }
