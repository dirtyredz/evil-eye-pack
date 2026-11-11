'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Dot-source the callable lifecycle module with OS operations replaced. Never run the controller.
function probe(body) {
  const script = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
. '${path.resolve(__dirname, "../../../scripts/server/server-process.ps1").replaceAll("'", "''")}'
$Marker = '-Dewl.server=anu-world'
function Get-CimInstance { param($ClassName, $Filter) $script:processes }
function Get-NetTCPConnection { param($State, $ErrorAction, $LocalPort) $script:ports }
function Invoke-CimMethod { throw 'UNSAFE: launch attempted' }
function Stop-Process { throw 'UNSAFE: kill attempted' }
$processes = @()
$ports = @()
${body}
`;
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 15000, windowsHide: true });
}
const win = { skip: process.platform !== 'win32' };
test('hidden elevated Java is detected from both server listeners', win, () => {
  const r = probe(`
$processes = @([pscustomobject]@{ProcessId=42; CommandLine=$null})
$ports = @(25565,25575 | ForEach-Object { [pscustomobject]@{LocalPort=$_; OwningProcess=42} })
if ((Get-ServerProc).ProcessId -ne 42) { throw 'server not detected' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('Start with a hidden running server exits zero before launching', win, () => {
  const r = probe(`
$processes = @([pscustomobject]@{ProcessId=42; CommandLine=$null})
$ports = @(25565,25575 | ForEach-Object { [pscustomobject]@{LocalPort=$_; OwningProcess=42} })
$Op='Start'
if ((Invoke-ServerStart) -ne 0) { throw 'Start did not return zero' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Already running\./);
});
test('visible marker works before ports open; stopped returns no process', win, () => {
  const r = probe(`
if (Get-ServerProc) { throw 'phantom server' }
$processes = @([pscustomobject]@{ProcessId=42; CommandLine="java $Marker nogui"})
if ((Get-ServerProc).ProcessId -ne 42) { throw 'booting server lost' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('unknown Java or conflicting listeners fail closed', win, () => {
  const r = probe(`
foreach ($scenario in 'hidden','other','split') {
  $processes = @([pscustomobject]@{ProcessId=42; CommandLine=$null})
  $ports = @()
  if ($scenario -eq 'other') {
    $processes[0].CommandLine='java -jar unrelated.jar'
    $ports = @([pscustomobject]@{LocalPort=25565; OwningProcess=42})
  }
  if ($scenario -eq 'split') {
    $ports = @([pscustomobject]@{LocalPort=25565; OwningProcess=42}, [pscustomobject]@{LocalPort=25575; OwningProcess=43})
  }
  $refused=$false
  try { Get-ServerProc | Out-Null } catch { $refused=$true }
  if (-not $refused) { throw "did not refuse $scenario" }
}
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('Stop follows a known hidden process after ports close, rejecting reused PID', win, () => {
  const r = probe(`
$known = [pscustomobject]@{ProcessId=42; CommandLine=$null; CreationDate=[datetime]'2026-11-10T22:00:00'}
$processes = @($known)
if ((Get-ServerProc $known).ProcessId -ne 42) { throw 'lost shutdown process' }
$processes = @([pscustomobject]@{ProcessId=42; CommandLine=$null; CreationDate=[datetime]'2026-11-10T23:00:00'})
if (Get-ServerProc $known) { throw 'accepted recycled PID' }
$processes = @()
if (Get-ServerProc $known) { throw 'accepted exited process' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('Status survives denied process metrics and still reports a hidden server', win, () => {
  const r = probe(`
$processes = @([pscustomobject]@{ProcessId=42; CommandLine=$null})
$ports = @(25565,25575 | ForEach-Object { [pscustomobject]@{LocalPort=$_; OwningProcess=42} })
function Get-Process { throw 'Access denied' }
function Invoke-Rcon { 'There are 0 players online' }
function Test-Path { $false }
function Get-ChildItem { }
$Server='C:\\fixture'; $Backups='C:\\fixture'; $Op='Status'
if ((Invoke-ServerStatus) -ne 0) { throw 'Status failed' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /State: RUNNING pid 42/);
  assert.match(r.stdout, /Process metrics unavailable/);
});
test('Stop uses authenticated RCON for hidden server and refuses force-kill without marker', win, () => {
  const r = probe(`
$processes = @([pscustomobject]@{ProcessId=42; CommandLine=$null; CreationDate=[datetime]'2026-11-10T22:00:00'})
$ports = @(25565,25575 | ForEach-Object { [pscustomobject]@{LocalPort=$_; OwningProcess=42} })
$script:rcon=@()
function Invoke-Rcon { param($Cmd) $script:rcon += $Cmd }
function Start-Sleep { }
$TimeoutSec=1; $Op='Stop'
$refused=$false
try { Invoke-ServerStop -TimeoutSec 1 } catch {
  if ($_.Exception.Message -notmatch 'cannot safely force-kill') { throw }
  $refused=$true
}
if (-not $refused -or ($script:rcon -join ',') -ne 'save-all flush,stop') { throw 'unsafe shutdown' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('Start rechecks after acquiring its guard and releases the handle on already-running exit', win, t => {
  const base = path.resolve(__dirname, '../../../.tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'ctl-guard-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const r = probe(`
$script:queries=0
function Get-CimInstance {
  $script:queries++
  if ($script:queries -gt 1) { [pscustomobject]@{ProcessId=42; CommandLine="java $Marker"} }
}
$Ctl='${dir.replaceAll("'", "''")}'; $Op='Start'
if ((Invoke-ServerStart) -ne 0) { throw 'Start failed' }
# Reopen inside this process: subprocess exit must not hide a leaked guard.
$guard = [IO.File]::Open((Join-Path $Ctl 'start.guard'), 'Open', 'ReadWrite', 'None')
$guard.Dispose()
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Already running\./);
  assert.ok(fs.existsSync(path.join(dir, 'start.guard')));
  fs.unlinkSync(path.join(dir, 'start.guard'));
});

test('Stop returns zero for stopped, graceful shutdown and PID reuse; only marked survivor returns three', win, () => {
  const r = probe(`
function Start-Sleep { }
if ((Invoke-ServerStop) -ne 0) { throw 'stopped exit code' }
foreach ($scenario in 'graceful','reuse','forced') {
  $processes = @([pscustomobject]@{ProcessId=42; CommandLine="java $Marker"; CreationDate=[datetime]'2026-11-10T22:00:00'})
  $script:killed = 0
  function Invoke-Rcon {
    param($Cmd)
    if ($Cmd -eq 'stop') {
      if ($scenario -eq 'graceful') { $script:processes = @() }
      if ($scenario -eq 'reuse') { $script:processes = @([pscustomobject]@{ProcessId=42; CommandLine="java $Marker"; CreationDate=[datetime]'2026-11-10T23:00:00'}) }
    }
  }
  function Stop-Process { param($Id, [switch]$Force) if ($Id -ne 42 -or -not $Force) { throw 'wrong kill' }; $script:killed++ }
  $code = Invoke-ServerStop -TimeoutSec 1
  if ($scenario -eq 'forced') {
    if ($code -ne 3 -or $killed -ne 1) { throw 'forced exit code' }
  } elseif ($code -ne 0 -or $killed) { throw "unsafe $scenario stop" }
}
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('Start returns boot result codes, passes priority and releases guard on launch failure', win, t => {
  const base = path.resolve(__dirname, '../../../.tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'ctl-start-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const r = probe(`
$Ctl='${dir.replaceAll("'", "''")}'; $Server=$Ctl; $Java='fixture-java'; $ArgsFile='fixture-args'
function Start-Sleep { }
function New-Item { }
function Get-CimInstance { [pscustomobject]@{FreePhysicalMemory=16MB} }
$script:metric = [pscustomobject]@{PriorityClass='Normal'}
function Get-Process { $script:metric }
function Test-Path { $scenario -eq 'ready' }
function Get-Item { [pscustomobject]@{LastWriteTime=Get-Date} }
function Select-String { [pscustomobject]@{Line=']: Done (fixture)'} }
function Get-ServerProc {
  if ($script:launched -and $scenario -ne 'exited') { [pscustomobject]@{ProcessId=42} }
}
function Invoke-CimMethod {
  param($ClassName, $MethodName, $Arguments)
  if ($ClassName -ne 'Win32_Process' -or $MethodName -ne 'Create' -or
      $Arguments.CurrentDirectory -ne $Server -or $Arguments.CommandLine -notmatch 'fixture-java -Dewl.server=anu-world') { throw 'wrong launch' }
  if ($scenario -eq 'failure') { return [pscustomobject]@{ReturnValue=5; ProcessId=0} }
  $script:launched=$true
  [pscustomobject]@{ReturnValue=0; ProcessId=41}
}
foreach ($scenario in 'ready','timeout','exited','failure') {
  $script:launched=$false
  if ($scenario -eq 'failure') {
    $refused=$false
    try { Invoke-ServerStart } catch {
      if ($_.Exception.Message -ne 'Win32_Process.Create failed: 5') { throw }
      $refused=$true
    }
    if (-not $refused) { throw 'launch failure ignored' }
  } else {
    $code=Invoke-ServerStart -TimeoutSec 22 -Priority BelowNormal
    $expected=if ($scenario -eq 'ready') { 0 } else { 2 }
    if ($code -ne $expected) { throw "wrong $scenario code: $code" }
    if ($scenario -eq 'ready' -and $metric.PriorityClass -ne 'BelowNormal') { throw 'priority lost' }
  }
  $guard=[IO.File]::Open((Join-Path $Ctl 'start.guard'), 'Open', 'ReadWrite', 'None')
  $guard.Dispose()
}
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
