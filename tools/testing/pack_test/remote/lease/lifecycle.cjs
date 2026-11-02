'use strict';
const { refreshDirLock, releaseDirLock } = require('./dir_lock.cjs');

// Capture the acquired identity once. A failed refresh is terminal; never adopt owner.json's claim.
function startLease({ job, scope, status, log, exit = (code) => process.exit(code), signals = process, timers = globalThis }) {
  const lease = Object.freeze({ ...job.lease });
  refreshDirLock(job.lock, lease);
  let closed = false;
  const disarm = () => {
    closed = true;
    timers.clearInterval(heartbeat);
    signals.removeListener('SIGTERM', stop);
    signals.removeListener('SIGINT', stop);
  };
  const stop = (error = 'agent terminated') => {
    if (closed) return;
    disarm();
    log(`${error}; killing children`);
    try {
      scope.killAll();
      status({ state: 'error', error });
      releaseDirLock(job.lock, lease);
    } finally { exit(2); }
  };
  const heartbeat = timers.setInterval(() => {
    if (closed) return;
    try { refreshDirLock(job.lock, lease); }
    catch (e) { stop(`lock refresh failed: ${e.message}`); }
  }, 30000);
  signals.once('SIGTERM', stop);
  signals.once('SIGINT', stop);
  return {
    close() {
      if (closed) return;
      disarm();
      releaseDirLock(job.lock, lease);
    }
  };
}

module.exports = { startLease };
