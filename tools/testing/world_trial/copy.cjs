'use strict';
// All mutable world bytes are copied, never linked. Validate every ancestor as well as children.
const fs = require('node:fs');
const path = require('node:path');
const { inside, noLinks, output, PROTECTED } = require('../../data_io/path_guard.cjs');
function files(root) {
  noLinks(root);
  const out = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name), s = fs.lstatSync(p);
      if (s.isSymbolicLink()) throw new Error('Symlink/junction refused: ' + p);
      if (s.isDirectory()) walk(p);
      else if (s.isFile()) out.push(path.relative(root, p).split(path.sep).join('/'));
      else throw new Error('Non-regular world entry: ' + p);
    }
  }
  walk(root); return out.sort();
}
function copy(source, dest, job, protectedPaths = PROTECTED) {
  output(dest, job, protectedPaths); noLinks(source);
  if (inside(source,dest) || inside(dest,source)) throw new Error('Overlapping copy paths');
  if (fs.existsSync(dest)) throw new Error('Destination already exists: ' + dest);
  const entries = files(source);
  fs.mkdirSync(dest, { recursive: true });
  for (const rel of entries) {
    const from = path.join(source,rel), to = path.join(dest,rel);
    noLinks(from); noLinks(to);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
  }
  return entries.length;
}
module.exports = { files, copy };
