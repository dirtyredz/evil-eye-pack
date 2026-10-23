'use strict';
// The PowerShell the launcher runs on ANU to start, watch and kill the agent. Pure string templates.
const cfg = require('./config.cjs');
const { q } = require('./ssh.cjs');
const { nodeExe } = require('./provision.cjs');

// Win32_Process.Create: the agent is not a child of sshd, so it survives the session; BelowNormal is
// inherited by the Java server it starts.
const launchScript = (jobFile) => `
$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ PriorityClass = [uint32]16384; ShowWindow = [uint16]0 }
$cmd = '"' + ${q(nodeExe)} + '" "' + ${q(`${cfg.CODE}\\pack_test\\remote\\agent.cjs`)} + '" "' + ${q(jobFile)} + '"'
$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = ${q(cfg.ROOT)}; ProcessStartupInformation = $si }
if ($r.ReturnValue -ne 0) { throw "Win32_Process.Create returned $($r.ReturnValue)" }
Write-Output "PID $($r.ProcessId)"`;

const statusScript = (runDir, agentPid) => `$s = Join-Path ${q(runDir)} 'status.json'
$alive = [bool](Get-Process -Id ${Number(agentPid)} -ErrorAction SilentlyContinue)
$body = if (Test-Path $s) { Get-Content -Raw $s } else { '{}' }
Write-Output ("ALIVE=$alive"); Write-Output $body`;

// Kills a remote agent and everything it started (used on interrupt).
const killScript = (agentPid) => `taskkill /PID ${Number(agentPid)} /T /F 2>&1 | Out-Null; Write-Output done`;

module.exports = { launchScript, statusScript, killScript };
