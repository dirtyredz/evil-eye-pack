'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { copy } = require('./copy.cjs');
const { manifest, verify } = require('../../data_io/world/manifest.cjs');
const { output } = require('../../data_io/path_guard.cjs');
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
module.exports = { snapshot };
