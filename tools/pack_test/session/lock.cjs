'use strict';
// A single-holder lock file ({ pid, host, at, owner }) for the local staged server. A lock whose process is
// gone, or older than staleMs, is taken over. (The ANU one-job lock is remote/lease/dir_lock.cjs.)
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

module.exports = { tryLock, localLock, alive };
