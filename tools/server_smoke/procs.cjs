'use strict';
// Hidden child processes only: windowsHide on every spawn, no shell, no GUI flags.
// A scope owns the children it starts so a caller can kill all of them on success, failure or interrupt.
const { spawn, spawnSync } = require('node:child_process');

function killTree(pid) {
  if (!pid) return;
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
}

// spawnImpl and killImpl are injectable for tests; production uses child_process and taskkill.
function scope({ spawnImpl = spawn, killImpl = killTree } = {}) {
  const owned = new Set();
  let cancelled = false;

  // Every child process goes through here: always hidden, never via a shell.
  function start(exe, args, opts = {}) {
    if (cancelled) throw new Error(`process scope cancelled; not starting ${exe}`);
    const p = spawnImpl(exe, args, { ...opts, windowsHide: true, shell: false });
    owned.add(p);
    const forget = () => owned.delete(p);
    p.once('exit', forget);
    p.once('error', forget);
    return p;
  }

  // Runs to completion and collects output. timeoutMs bounds it: the tree is killed and code is -1.
  function run(exe, args, opts = {}) {
    return new Promise((resolve) => {
      let p;
      try { p = start(exe, args, { cwd: opts.cwd, env: opts.env, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { resolve({ code: -1, out: String(e) }); return; }
      let out = '';
      let timedOut = false;
      const take = (d) => { out += d; };
      p.stdout.on('data', take);
      p.stderr.on('data', take);
      const timer = opts.timeoutMs ? setTimeout(() => { timedOut = true; killImpl(p.pid); }, opts.timeoutMs) : null;
      const done = (r) => { if (timer) clearTimeout(timer); resolve(timedOut ? { code: -1, out, timedOut: true } : r); };
      p.on('error', (e) => done({ code: -1, out: String(e) }));
      p.on('close', (code) => done({ code, out }));
    });
  }

  // Kills every live child's tree. Further start() calls fail once cancelled.
  function killAll({ cancel = true } = {}) {
    if (cancel) cancelled = true;
    const pids = [...owned].map((p) => p.pid).filter(Boolean);
    for (const pid of pids) killImpl(pid);
    owned.clear();
    return pids;
  }

  return { start, run, killAll, get size() { return owned.size; }, get cancelled() { return cancelled; } };
}

// The default scope keeps the original module-level API for existing callers.
const shared = scope();
const start = shared.start;
const run = shared.run;

// Priority and CPU time of the server JVM (Windows, via PowerShell on the PID boot() spawned: java itself, no wrapper).
const PRIORITIES = ['Idle', 'BelowNormal', 'Normal', 'AboveNormal', 'High'];
const PS_TIMEOUT_MS = 30000;

async function setPriority(pid, priority, s = shared) {
  if (!priority || priority === 'none') return { ok: true, skipped: true };
  if (!PRIORITIES.includes(priority)) return { ok: false, out: `unknown priority ${priority}` };
  const r = await s.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Process -Id ${Number(pid)}).PriorityClass = '${priority}'`], { timeoutMs: PS_TIMEOUT_MS });
  return { ok: r.code === 0, out: r.out.trim() };
}

// Total processor seconds of a PID, or null when it is gone / unreadable.
async function cpuSeconds(pid, s = shared) {
  const r = await s.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `(Get-Process -Id ${Number(pid)}).TotalProcessorTime.TotalSeconds`], { timeoutMs: PS_TIMEOUT_MS });
  const n = parseFloat(r.out.trim());
  return r.code === 0 && Number.isFinite(n) ? n : null;
}

module.exports = { scope, start, run, killTree, setPriority, cpuSeconds, PRIORITIES };
