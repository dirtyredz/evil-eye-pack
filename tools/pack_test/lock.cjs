'use strict';
// A single-holder lock file ({ pid, host, at, owner }). A lock whose process is gone, or older than
// staleMs, is taken over. Used for the local staged server and, on ANU, for the one-heavy-job rule.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

function tryLock(file, { owner = '', staleMs = 4 * 3600 * 1000, now = Date.now } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const body = JSON.stringify({ pid: process.pid, host: os.hostname(), at: now(), owner });
  try {
    fs.writeFileSync(file, body, { flag: 'wx' });
    return { ok: true };
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  let held = null;
  try { held = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* torn write: treat as stale */ }
  const stale = !held || (held.host === os.hostname() && !alive(held.pid)) || now() - held.at > staleMs;
  if (!stale) return { ok: false, held };
  fs.rmSync(file, { force: true });
  return tryLock(file, { owner, staleMs, now });
}

// Releases only a lock this process still holds.
const holder = (file) => ({ release: () => { try { if (JSON.parse(fs.readFileSync(file, 'utf8')).pid === process.pid) fs.rmSync(file, { force: true }); } catch { /* already gone */ } } });

// Synchronous: throws when another live process holds it.
function localLock(file, opts) {
  const r = tryLock(file, opts);
  if (!r.ok) throw new Error(`locked by pid ${r.held.pid} on ${r.held.host} since ${new Date(r.held.at).toISOString()} (${file})`);
  return holder(file);
}

// Waits up to waitMs for the lock, polling every pollMs.
async function waitLock(file, { waitMs, pollMs = 5000, onWait = () => {}, ...opts }) {
  const until = Date.now() + waitMs;
  for (;;) {
    const r = tryLock(file, opts);
    if (r.ok) return holder(file);
    if (Date.now() >= until) return null;
    onWait(r.held);
    await new Promise((res) => setTimeout(res, pollMs));
  }
}

module.exports = { tryLock, localLock, waitLock, alive };
