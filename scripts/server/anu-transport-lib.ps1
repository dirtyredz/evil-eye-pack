<#
.SYNOPSIS
  Dot-sourced by anu-world-server.ps1: ssh/scp transport to ANU and the shipped remote controller.
  Expects the caller's script scope to define $AnuHost, $AnuCtl, $AnuAddr, $Ctl, $DryRun, $McNet (path of mc-net.cjs)
  and the owner-run helpers (Invoke-Native, Invoke-NativeCapture, Write-Log, Complete-OwnerRun).
  Not an entry point: dot-sourced, no parameters of its own.
#>

# Windows' own bsdtar. A bare 'tar' under Git Bash resolves to GNU /usr/bin/tar, which reads 'C:/...' as host 'C'.
function Get-WindowsTar {
  $exe = Join-Path $env:SystemRoot 'System32\tar.exe'
  if (-not (Test-Path -LiteralPath $exe)) { throw "Windows tar not found at $exe" }
  return $exe
}

function Convert-ToScpPath([string]$WindowsPath) { $WindowsPath.Replace('\', '/') }

function Invoke-Ssh([string]$Command, [int]$FailCode = 3) {
  $rc = Invoke-Native 'ssh' @($AnuHost, $Command)
  if ($rc -ne 0) { Complete-OwnerRun $FailCode "ssh command failed (exit $rc): $Command" }
}
# Capture stdout separately: SSH stderr warnings must never become paths or query values.
# A failed query cannot be mistaken for an absent world, backup or stopped server.
function Invoke-SshQuery([string]$Command) {
  $result = Invoke-NativeCapture { & ssh $AnuHost $Command }
  if ($result.ExitCode -ne 0) { throw "ssh query failed (exit $($result.ExitCode)): $Command" }
  return $result
}
# Recovery callers need the native exit code without terminating the original failed run.
function Invoke-CtlExitCode([string]$CtlArgs) {
  return (Invoke-Native 'ssh' @($AnuHost, "powershell -NoProfile -ExecutionPolicy Bypass -File $Ctl $CtlArgs"))
}
function Invoke-Ctl([string]$CtlArgs, [int]$FailCode = 3) {
  $rc = Invoke-CtlExitCode $CtlArgs
  if ($rc -ne 0) { Complete-OwnerRun $FailCode "ssh command failed (exit ${rc}): powershell -NoProfile -ExecutionPolicy Bypass -File $Ctl $CtlArgs" }
}
function Send-ToAnu([string]$LocalPath, [string]$RemotePath, [string]$What) {
  $rc = Invoke-Native 'scp' @('-q', $LocalPath, "${AnuHost}:$(Convert-ToScpPath $RemotePath)")
  if ($rc -ne 0) { Complete-OwnerRun 3 "scp $What failed (exit $rc)" }
}
function Get-FromAnu([string]$RemotePath, [string]$LocalPath, [string]$What) {
  $rc = Invoke-Native 'scp' @('-q', "${AnuHost}:$(Convert-ToScpPath $RemotePath)", $LocalPath)
  if ($rc -ne 0) { Complete-OwnerRun 3 "scp $What failed (exit $rc)" }
}
# Ships the remote controller (server-ctl.ps1), lifecycle module (server-process.ps1) and network client (mc-net.cjs) to ANU's ctl folder.
function Send-Ctl {
  if ($DryRun) { Write-Log "DryRun: would copy server-ctl.ps1, server-process.ps1 and mc-net.cjs to ${AnuHost}:$AnuCtl"; return }
  Invoke-Ssh "New-Item -ItemType Directory -Force $AnuCtl | Out-Null"
  Send-ToAnu (Join-Path $PSScriptRoot 'server-process.ps1') "$AnuCtl\server-process.ps1" 'server-process.ps1'
  Send-ToAnu (Join-Path $PSScriptRoot 'server-ctl.ps1') "$AnuCtl\server-ctl.ps1" 'server-ctl.ps1'
  Send-ToAnu $McNet "$AnuCtl\mc-net.cjs" 'mc-net.cjs'
}
function Test-ServerRunning {
  $r = Invoke-SshQuery "powershell -NoProfile -ExecutionPolicy Bypass -File $Ctl -Op Status"
  if ($r.Output -notmatch 'State: (RUNNING|STOPPED)') {
    throw ('Cannot determine server state safely: ' + $r.Output.Trim())
  }
  return ($r.Output -match 'State: RUNNING')
}
# Server list ping from Valhalla; fails the run (exit 2) when the server does not answer.
function Test-ServerPing {
  $r = Invoke-NativeCapture { & node $McNet ping $AnuAddr 25565 2>&1 }
  $ping = $r.Output
  $rc = $r.ExitCode
  Write-Log ("Ping from Valhalla to {0}:25565 -> {1}" -f $AnuAddr, $ping.Trim())
  if ($rc -ne 0) { Complete-OwnerRun 2 'server list ping failed' }
}
