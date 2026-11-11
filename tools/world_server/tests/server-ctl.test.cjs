'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Execute the production function AST, with every OS query replaced. Never run the controller.
function probe(body) {
  const script = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$ast = [Management.Automation.Language.Parser]::ParseFile('${path.resolve(__dirname, '../../../scripts/server/server-ctl.ps1').replaceAll("'", "''")}', [ref]$null, [ref]$null)
$ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst]}, $false) | ForEach-Object { Invoke-Expression $_.Extent.Text }
$Marker = '-Dewl.server=anu-world'
function Get-CimInstance { param($ClassName, $Filter) $script:processes }
function Get-NetTCPConnection { param($State, $ErrorAction) $script:ports }
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
$switch=$ast.Find({param($n) $n -is [Management.Automation.Language.SwitchStatementAst]}, $false)
Invoke-Expression $switch.Extent.Text
throw 'Start did not exit'
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
$switch=$ast.Find({param($n) $n -is [Management.Automation.Language.SwitchStatementAst]}, $false)
Invoke-Expression $switch.Extent.Text
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
$switch=$ast.Find({param($n) $n -is [Management.Automation.Language.SwitchStatementAst]}, $false)
$refused=$false
try { Invoke-Expression $switch.Extent.Text } catch {
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
$switch=$ast.Find({param($n) $n -is [Management.Automation.Language.SwitchStatementAst]}, $false)
Invoke-Expression $switch.Extent.Text
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Already running\./);
  assert.ok(fs.existsSync(path.join(dir, 'start.guard')));
  fs.unlinkSync(path.join(dir, 'start.guard'));
});
