'use strict';
// Wait until no other Minecraft/Forge JVM runs on this host, so one boot never shares the
// machine with another. Fails closed: an inconclusive process inventory counts as busy.
const { setTimeout: sleep } = require('node:timers/promises');

async function waitForServer(scope, { now = Date.now, wait = sleep, log = console.log, budgetMs = 45 * 60000 } = {}) {
  const deadline = now() + budgetMs;
  for (;;) {
    if (scope.cancelled) throw new Error('Interrupted while waiting for the host');
    const r = await scope.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^javaw?\.exe$' -and $_.CommandLine -match 'forge|minecraft|BootstrapLauncher' } | Select-Object ProcessId,@{Name='CommandLine';Expression={$_.CommandLine.Substring(0,[Math]::Min(250,$_.CommandLine.Length))}} | ConvertTo-Json -Compress"], { timeoutMs: 60000 });
    if (r.code === 0 && !r.out.trim()) return;
    const reason = r.code === 0 ? 'Another Minecraft JVM is running: ' : 'Could not inspect running servers: ';
    if (now() >= deadline) throw new Error('Host unavailable after 45 minutes. ' + reason + r.out.slice(0, 500));
    log('Waiting. ' + reason + r.out.trim().slice(0, 500));
    await wait(Math.min(60000, deadline - now()));
  }
}
module.exports = { waitForServer };
