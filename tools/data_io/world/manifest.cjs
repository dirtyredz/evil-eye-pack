'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { files } = require('./world_tree.cjs');
function manifest(root) {
  return Object.fromEntries(files(root).map(rel => {
    const bytes = fs.readFileSync(path.join(root, rel));
    return [rel, { bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }];
  }));
}
function verify(root, expected) {
  const actual = manifest(root);
  const changed = [...new Set([...Object.keys(actual), ...Object.keys(expected)])]
    .filter(k => JSON.stringify(actual[k]) !== JSON.stringify(expected[k]));
  if (changed.length) throw new Error('Manifest mismatch: ' + changed.join(', '));
  return { files: Object.keys(actual).length, bytes: Object.values(actual).reduce((n,v) => n+v.bytes,0) };
}
module.exports = { manifest, verify };
