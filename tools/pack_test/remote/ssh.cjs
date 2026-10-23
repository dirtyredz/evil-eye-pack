'use strict';
// SSH/SCP to ANU through the run's process scope. Remote commands are PowerShell, sent base64-encoded
// (-EncodedCommand) so no quoting survives two shells by accident. BatchMode: never prompts.
const cfg = require('./config.cjs');

const OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];

const encode = (script) => Buffer.from(`$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'\n${script}`, 'utf16le').toString('base64');

function client(scope, host = cfg.HOST) {
  // Runs a PowerShell script on ANU. Resolves { code, out }; code -1 on timeout or spawn failure.
  const ps = (script, { timeoutMs = 120000 } = {}) =>
    scope.run('ssh', [...OPTS, host, `powershell -NoProfile -NonInteractive -EncodedCommand ${encode(script)}`], { timeoutMs });
  const remotePath = (p) => `${host}:${p.replace(/\\/g, '/')}`;
  const scpTo = (local, remote, { timeoutMs = 1800000 } = {}) => scope.run('scp', [...OPTS, '-q', local, remotePath(remote)], { timeoutMs });
  const scpFrom = (remote, local, { timeoutMs = 1800000 } = {}) => scope.run('scp', [...OPTS, '-q', remotePath(remote), local], { timeoutMs });
  // Throws with the remote output when the script fails.
  const must = async (script, opts) => {
    const r = await ps(script, opts);
    if (r.code !== 0) throw new Error(`ANU command failed (${r.timedOut ? 'timeout' : `exit ${r.code}`}): ${r.out.trim().slice(0, 600)}`);
    return r.out;
  };
  return { host, ps, must, scpTo, scpFrom };
}

// The first alias that answers, or null. ConnectTimeout bounds each try.
async function connect(scope) {
  for (const host of [cfg.HOST, cfg.FALLBACK_HOST]) {
    const c = client(scope, host);
    const r = await c.ps('Write-Output ready', { timeoutMs: 30000 });
    if (r.code === 0 && /ready/.test(r.out)) return c;
  }
  return null;
}

// PowerShell single-quoted literal.
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

module.exports = { client, connect, encode, q };
