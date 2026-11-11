'use strict';
// Shared path guard for tools that write below a job folder or touch instance folders: no symlinks or
// junctions anywhere on the path, containment checks, and protected-output refusal.
const fs = require('node:fs');
const path = require('node:path');
const { ARTIFACT_JOBS } = require('../runtime_env/env.cjs').FIXED;
const PROTECTED = ['C:/Users/dirty/MultiMC/instances', 'C:/Users/dirty/projects/evil-eye-pack'];
function inside(a, b) {
  const rel = path.relative(path.resolve(b), path.resolve(a)).toLowerCase();
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
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
module.exports = { inside, artifactJob, noLinks, output, PROTECTED };
