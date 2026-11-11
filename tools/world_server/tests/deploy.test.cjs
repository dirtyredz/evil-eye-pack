'use strict';
// Deploy/CopyWorld use Windows' System32 tar (not Git Bash's GNU tar) and Deploy restarts the server on early failure.
// Never touches ANU: ssh/scp/Invoke-Native are stubbed.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const win = { skip: process.platform !== 'win32' };
const psPath = p => path.resolve(__dirname, '../../../', p).replaceAll("'", "''");
function probe(body) {
  const script = `
$ErrorActionPreference='Stop'
Set-StrictMode -Version 2
. '${psPath('scripts/server/anu-transport-lib.ps1')}'
. '${psPath('scripts/server/anu-deploy-lib.ps1')}'
function ssh { throw 'UNSAFE: real SSH attempted' }
function scp { throw 'UNSAFE: real SCP attempted' }
function Write-Log([string]$m) { Write-Output "LOG: $m" }
function Complete-OwnerRun([int]$Code, [string]$Reason) { Write-Output "COMPLETE $Code $Reason"; exit $Code }
$AnuHost='fixture-host'; $AnuRoot='G:\\fixture'; $Ctl='G:\\fixture\\ctl\\server-ctl.ps1'; $Jobs='C:/fixture-jobs'
$StageCli='stage.cjs'; $PrivateCache='cache'; $HeapGb=10; $OpName='n'; $OpUuid='u'; $DryRun=$false
function Send-Ctl { }
function Test-ServerRunning { return $false }
${body}
`;
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', timeout: 20000, windowsHide: true });
}
test('Get-WindowsTar resolves to System32 tar.exe even with another tar first on PATH', win, () => {
  const r = probe(`
$fake = Join-Path ([IO.Path]::GetTempPath()) 'fake-gnu-tar'
New-Item -ItemType Directory -Force $fake | Out-Null
Set-Content -LiteralPath (Join-Path $fake 'tar.exe') -Value 'x'
$env:PATH = "$fake;$env:PATH"
$t = Get-WindowsTar
Remove-Item -Recurse -Force $fake
$want = Join-Path $env:SystemRoot 'System32\\tar.exe'
if ($t -ne $want) { throw "tar resolved to $t, wanted $want" }
`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('no bare tar remains on any local Invoke-Native call in the ANU scripts', () => {
  for (const f of ['anu-deploy-lib.ps1', 'anu-world-lib.ps1']) {
    const text = fs.readFileSync(path.resolve(__dirname, '../../../scripts/server', f), 'utf8');
    assert.doesNotMatch(text, /Invoke-Native\s+'tar'/, f);
    assert.doesNotMatch(text, /Invoke-Ssh\s+"tar /, f);
  }
});
test('Deploy that fails before the remote files change starts the server again', win, () => {
  const r = probe(`
function Invoke-Native([string]$Exe, [string[]]$Arguments) { Write-Host "NATIVE $Exe $($Arguments -join ' ')"; if ($Exe -eq 'node') { return 5 }; return 0 }
Invoke-Deploy
`);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout, /COMPLETE 3 staging failed/);
  assert.match(r.stdout, /NATIVE ssh fixture-host powershell .* -Op Start/);
  assert.match(r.stdout, /starting the server again/);
});
test('Deploy that fails after the remote files changed does not start a half-deployed server', win, () => {
  const r = probe(`
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
  Write-Host "NATIVE $Exe $($Arguments -join ' ')"
  if ($Exe -eq 'ssh' -and ($Arguments -join ' ') -match 'Remove-Item -Recurse') { return 9 }
  return 0
}
Invoke-Deploy
`);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.doesNotMatch(r.stdout, /-Op Start/);
  assert.match(r.stdout, /NOT restarting/);
});

test('failed recovery reports the controller exit code and preserves the original Deploy failure', win, () => {
  const r = probe(`
function Invoke-Native([string]$Exe, [string[]]$Arguments) { if ($Exe -eq 'node') { return 5 }; throw 'recovery bypassed transport' }
function Invoke-CtlExitCode([string]$CtlArgs) { if ($CtlArgs -ne '-Op Start') { throw 'wrong recovery operation' }; return 17 }
Invoke-Deploy
`);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stdout, /COMPLETE 3 staging failed/);
  assert.match(r.stdout, /WARNING: restart after failed Deploy failed \(exit 17\); run Start manually\./);
});
