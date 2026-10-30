'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { files, copy, output } = require('./copy.cjs');
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
function snapshot(source, job) {
  const dest = path.join(job,'snapshot'), record = path.join(job,'source-manifest.json');
  output(record,job);
  if (fs.existsSync(record)) throw new Error('Snapshot manifest already exists');
  const before = manifest(source);
  copy(source,dest,job);
  verify(source,before); verify(dest,before);
  fs.writeFileSync(record,JSON.stringify({ source, snapshot:dest, created:new Date().toISOString(), files:before },null,2)+'\n',{flag:'wx'});
  for (const rel of Object.keys(before)) fs.chmodSync(path.join(dest,rel),0o444);
  fs.chmodSync(record,0o444);
  return { source, snapshot:dest, files:before };
}
module.exports = { manifest, verify, snapshot };
