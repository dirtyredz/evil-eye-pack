'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const win = { skip: process.platform !== 'win32' };
const psPath = p => path.resolve(__dirname, '../../../', p).replaceAll("'", "''");
function probe(body) {
  const script = `
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2
. '${psPath('scripts/owner/owner-run.ps1')}'
. '${psPath('scripts/server/anu-transport-lib.ps1')}'
$AnuHost='fixture-host'; $AnuCtl='G:\\fixture\\ctl'; $Ctl="$AnuCtl\\server-ctl.ps1"
function ssh { throw 'UNSAFE: real SSH attempted' }
function scp { throw 'UNSAFE: real SCP attempted' }
${body}
`;
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 15000, windowsHide: true });
}
test('native capture preserves exit code and stdout despite native stderr under EAP Stop', win, () => {
  const r = probe(`
$r = Invoke-NativeCapture { & '${process.execPath.replaceAll("'", "''")}' -e 'process.stdout.write(String.fromCharCode(118,97,108,117,101));process.stderr.write(String.fromCharCode(119,97,114,110,105,110,103));process.exitCode=7' }
if ($r.Output.Trim() -ne 'value' -or $r.ExitCode -ne 7) { throw 'capture corrupted' }
if ($ErrorActionPreference -ne 'Stop') { throw 'preference leaked' }
$r = Invoke-NativeCapture { & '${process.execPath.replaceAll("'", "''")}' -e 'process.stderr.write(String.fromCharCode(119,97,114,110,105,110,103))' 2>&1 }
if ($r.Output -notmatch 'warning' -or $r.ExitCode -ne 0) { throw 'merged capture corrupted' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('SSH query owns host selection and rejects native failures; Status fails closed', win, () => {
  const r = probe(`
$script:answer='True'; $script:code=0
function ssh {
  param($Target, $Command)
  if ($Target -ne 'fixture-host' -or -not $Command) { throw 'wrong query target' }
  $script:LASTEXITCODE=$script:code
  $script:answer
}
$r=Invoke-SshQuery 'Test-Path fixture'
if ($r.Output.Trim() -ne 'True' -or $r.ExitCode -ne 0) { throw 'query result' }
$script:answer='State: RUNNING'; if (-not (Test-ServerRunning)) { throw 'lost running state' }
$script:answer='State: STOPPED'; if (Test-ServerRunning) { throw 'lost stopped state' }
foreach ($scenario in 'missing','failure') {
  $script:answer=if ($scenario -eq 'missing') { 'no state' } else { 'State: STOPPED' }
  $script:code=if ($scenario -eq 'failure') { 255 } else { 0 }
  $refused=$false
  try { Test-ServerRunning | Out-Null } catch { $refused=$true }
  if (-not $refused) { throw "accepted $scenario query" }
}
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('Send-Ctl ships lifecycle sibling before controller using its own source folder', win, () => {
  const r = probe(`
$DryRun=$false; $McNet='fixture-mc-net'
$script:sent=@()
function Invoke-Ssh { }
function Send-ToAnu { param($LocalPath, $RemotePath, $What) $script:sent += [pscustomobject]@{Local=$LocalPath; Remote=$RemotePath; What=$What} }
Send-Ctl
if (($sent.What -join ',') -ne 'server-process.ps1,server-ctl.ps1,mc-net.cjs') { throw 'incomplete shipment' }
if ($sent[0].Local -ne '${psPath('scripts/server/server-process.ps1')}' -or $sent[0].Remote -ne "$AnuCtl\\server-process.ps1") { throw 'wrong module path' }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
