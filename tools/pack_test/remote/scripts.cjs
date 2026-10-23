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

// Kills a remote agent and everything it started (used on interrupt and on the deadline). Windows reuses
// PIDs and ANU hosts other projects' processes, so the kill happens only when that PID's command line
// still holds this agent's script AND this run's job file; anything else prints MISMATCH and is left alone.
const AGENT_SCRIPT = 'pack_test\\remote\\agent.cjs';
const killScript = (agentPid, jobFile) => `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(agentPid)}" -ErrorAction SilentlyContinue
$c = if ($p) { [string]$p.CommandLine } else { '' }
if ($p -and $c.Contains(${q(AGENT_SCRIPT)}) -and $c.Contains(${q(jobFile)})) { taskkill /PID ${Number(agentPid)} /T /F 2>&1 | Out-Null; Write-Output 'KILLED' }
elseif ($p) { Write-Output 'MISMATCH: not our agent, left running' } else { Write-Output 'GONE' }`;

module.exports = { launchScript, statusScript, killScript, AGENT_SCRIPT };
