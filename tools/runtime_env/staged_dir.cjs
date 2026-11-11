'use strict';
// Lifecycle for a run's staged pack/instance/world copy (1-20 GB each). Every test runner stages a full copy
// below its own containment root; this deletes it when the run ends, however it ends, and keeps the evidence
// (reports, logs, crash reports). Nothing outside the run directory is ever removed.
const fs = require('node:fs');
const path = require('node:path');
const env = require('./env.cjs');
const { inside, noLinks, PROTECTED } = require('../data_io/path_guard.cjs');

const REMOVE_OPTS = { recursive: true, force: true, maxRetries: 5, retryDelay: 500 };
// The Stable jar cache must survive every cleanup; any directory called `cache` is shared state, never staging.
const stableCache = () => env.STABLE_CACHE;

// Throws unless `target` is strictly below `root`, link-free, and clear of protected/shared-cache paths.
function assertRemovable(target, root) {
  if (!target || !root) throw new Error('staged cleanup needs a target and its containment root');
  const t = path.resolve(target), r = path.resolve(root);
  if (!inside(t, r) || t.toLowerCase() === r.toLowerCase()) throw new Error(`refusing to delete outside the run directory: ${t} (run ${r})`);
  noLinks(t);
  if (path.relative(r, t).split(path.sep).some((s) => s.toLowerCase() === 'cache')) throw new Error(`refusing to delete a cache directory: ${t}`);
  for (const p of [...PROTECTED, stableCache()].filter(Boolean)) {
    if (inside(t, p) || inside(p, t)) throw new Error(`refusing to delete protected path: ${t}`);
  }
  return t;
}

// Deletes one staged directory (no-op if absent). Returns true if something was removed.
function removeStaged(target, root, { log = () => {} } = {}) {
  const t = assertRemovable(target, root);
  if (!fs.existsSync(t)) return false;
  fs.rmSync(t, REMOVE_OPTS);
  log(`removed staged copy ${t}`);
  return true;
}

// Deletes every top-level entry of `dir` (itself below `root`) that `keep(name)` does not claim.
function pruneStaged(dir, root, keep, { log = () => {} } = {}) {
  const d = assertRemovable(dir, root);
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d)) if (!keep(e)) removeStaged(path.join(d, e), root, { log });
}

// Runs fn(); then, unless `keep`, removes `dirs` (a function may supply them, for paths known only after the
// run starts) and prunes `prune` = { dir, keep(name) } down to the entries `keep` claims, on success, on a
// thrown error, and on process 'exit'. Everything removed must lie strictly below `root`. It installs no
// SIGINT/SIGTERM handlers: the runner owns the signal path (kills its child servers, picks the exit code) and
// either unwinds through the finally below or calls process.exit, which fires 'exit'. Removal failures are
// logged, never thrown: they must not mask the run's own error.
async function withStaged({ root, dirs = [], prune = null, keep = false, log = () => {} }, fn) {
  const targets = () => (typeof dirs === 'function' ? dirs() : dirs);
  const clean = () => {
    if (keep) return;
    try { if (prune) pruneStaged(prune.dir, root, prune.keep, { log }); } catch (e) { log(`staged prune skipped for ${prune.dir}: ${e.message}`); }
    for (const d of targets()) {
      try { removeStaged(d, root, { log }); } catch (e) { log(`staged cleanup skipped for ${d}: ${e.message}`); }
    }
  };
  process.once('exit', clean);
  try {
    return await fn();
  } finally {
    process.removeListener('exit', clean);
    clean();
  }
}

module.exports = { assertRemovable, removeStaged, pruneStaged, withStaged };
