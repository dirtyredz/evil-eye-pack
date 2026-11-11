'use strict';
// Sorted, read-only world traversal; reject links and non-regular entries.
const fs = require('node:fs');
const path = require('node:path');
const { noLinks } = require('../path_guard.cjs');
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
module.exports = { files };
