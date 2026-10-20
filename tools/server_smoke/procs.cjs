'use strict';
// Hidden child processes only: windowsHide on every spawn, no shell, no GUI flags.
const { spawn, spawnSync } = require('node:child_process');

// Every child process goes through here: always hidden, never via a shell.
function start(exe, args, opts = {}) {
  return spawn(exe, args, { ...opts, windowsHide: true, shell: false });
}

function run(exe, args, opts = {}) {
  return new Promise((resolve) => {
    const p = start(exe, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const take = (d) => { out += d; };
    p.stdout.on('data', take);
    p.stderr.on('data', take);
    p.on('error', (e) => resolve({ code: -1, out: String(e) }));
    p.on('close', (code) => resolve({ code, out }));
  });
}

function killTree(pid) {
  if (!pid) return;
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}

// Priority and CPU time of the server JVM (Windows, via PowerShell on the PID boot() spawned: java itself, no wrapper).
const PRIORITIES = ['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High'];

async function setPriority(pid, priority) {
  if (!priority || priority === 'none') return { ok: true, skipped: true };
  if (!PRIORITIES.includes(priority)) return { ok: false, out: `unknown priority ${priority}` };
  const r = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Process -Id ${Number(pid)}).PriorityClass = '${priority}'`]);
  return { ok: r.code === 0, out: r.out.trim() };
}

// Total processor seconds of a PID, or null when it is gone / unreadable.
async function cpuSeconds(pid) {
  const r = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Process -Id ${Number(pid)}).TotalProcessorTime.TotalSeconds`]);
  const n = parseFloat(r.out.trim());
  return r.code === 0 && Number.isFinite(n) ? n : null;
}

module.exports = { start, run, killTree, setPriority, cpuSeconds, PRIORITIES };
