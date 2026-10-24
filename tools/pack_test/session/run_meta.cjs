'use strict';
// Run identity: the artifact-root guard for writable run folders, the run id and what was tested (checkout
// commit, dirty state, pack and index hashes).
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../file_data/hash.cjs');
const { execFileSync } = require('node:child_process');

const norm = (p) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const inside = (child, parent) => norm(child) === norm(parent) || norm(child).startsWith(`${norm(parent)}/`);

// Writable run folders must sit under the artifacts root and never inside a checkout.
function checkDestination(dir, { artifacts, checkouts }) {
  if (!inside(dir, artifacts)) throw new Error(`refusing to write outside the artifacts root ${artifacts}: ${dir}`);
  for (const c of checkouts) if (inside(dir, c)) throw new Error(`refusing to write inside a checkout (${c}): ${dir}`);
}

const runId = (d = new Date()) => `run-${d.toISOString().replace(/[:.]/g, '-')}`;


function git(root, args) {
  try { return execFileSync('git', args, { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; }
}

// What was tested: checkout commit, dirty state and the pack/index hashes.
function runMeta(packToml) {
  const root = path.dirname(packToml);
  const read = (f) => (fs.existsSync(f) ? sha256(fs.readFileSync(f)) : null);
  return {
    checkout: root.replace(/\\/g, '/'),
    commit: git(root, ['rev-parse', 'HEAD']),
    branch: git(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: !!git(root, ['status', '--porcelain', '--untracked-files=no']),
    packSha256: read(packToml),
    indexSha256: read(path.join(root, 'index.toml'))
  };
}

module.exports = { checkDestination, runId, runMeta };
