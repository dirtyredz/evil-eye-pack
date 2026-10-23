'use strict';
// Interrupt callbacks for work that outlives a local process (a remote agent). Each registration returns a
// disposer; callers dispose when the work reaches a terminal state, so a later Ctrl+C never fires a stale
// callback (a remote PID may have been reused by then).
function abortRegistry() {
  const fns = [];
  return {
    register(fn) {
      fns.push(fn);
      return () => { const i = fns.indexOf(fn); if (i >= 0) fns.splice(i, 1); };
    },
    size: () => fns.length,
    async runAll(onError = () => {}) { for (const fn of fns.splice(0)) { try { await fn(); } catch (e) { onError(e); } } }
  };
}

module.exports = { abortRegistry };
