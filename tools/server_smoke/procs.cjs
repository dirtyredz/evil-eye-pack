'use strict';
// Hidden child processes only: windowsHide on every spawn, no shell, no GUI flags.
const { spawn, spawnSync } = require('node:child_process');

function run(exe, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(exe, args, { cwd: opts.cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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

module.exports = { run, killTree, spawn };
