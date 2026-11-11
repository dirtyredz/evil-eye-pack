'use strict';
// Shared path guard for tools that write below a job folder or touch instance folders: no symlinks or
// junctions anywhere on the path, containment checks, and protected-output refusal.
const fs = require('node:fs');
const path = require('node:path');
const { ARTIFACT_JOBS, INSTANCES, MAIN_CHECKOUT } = require('../runtime_env/env.cjs').FIXED;
const PROTECTED = [INSTANCES, MAIN_CHECKOUT];
function inside(a, b) {
  const rel = path.relative(path.resolve(b), path.resolve(a)).toLowerCase();
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
// Writable run folders must sit under the artifacts root and never inside a checkout.
function checkDestination(dir, { artifacts, checkouts }) {
  if (!inside(dir, artifacts)) throw new Error(`refusing to write outside the artifacts root ${artifacts}: ${dir}`);
  for (const c of checkouts) if (inside(dir, c)) throw new Error(`refusing to write inside a checkout (${c}): ${dir}`);
}
function artifactJob(dir, jobsRoot = ARTIFACT_JOBS) {
  if (!inside(dir, jobsRoot)) throw new Error('Job must be in artifact jobs');
}
function noLinks(target) {
  let p = path.resolve(target);
  for (;;) {
    if (fs.existsSync(p) || (() => { try { fs.lstatSync(p); return true; } catch { return false; } })()) {
      const s = fs.lstatSync(p);
      if (s.isSymbolicLink()) throw new Error('Symlink/junction refused: ' + p);
    }
    const parent = path.dirname(p); if (parent === p) break; p = parent;
  }
}
function output(target, job, protectedPaths = PROTECTED) {
  noLinks(job); noLinks(target);
  if (!inside(target, job) || path.resolve(target).toLowerCase() === path.resolve(job).toLowerCase()) throw new Error('Output must be below job: ' + target);
  if (protectedPaths.some(p => inside(target,p) || inside(p,target))) throw new Error('Protected output: ' + target);
}
module.exports = { inside, checkDestination, artifactJob, noLinks, output, PROTECTED };
