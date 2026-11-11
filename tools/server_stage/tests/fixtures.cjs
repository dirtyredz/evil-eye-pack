'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { describe: runtimeOf, writeStamp } = require('../../runtime_env/server/runtime.cjs');
const NEO = runtimeOf({ loader: 'neoforge', minecraft: '1.21.1', loaderVersion: '21.1.265' });
const FORGE = runtimeOf({ loader: 'forge', minecraft: '1.20.1', loaderVersion: '47.4.10' });

function fakeStage(root) {
  const stage = path.join(root, 'stage');
  for (const d of ['mods', 'libraries/x', 'config', 'kubejs/server_scripts']) fs.mkdirSync(path.join(stage, d), { recursive: true });
  fs.writeFileSync(path.join(stage, 'mods/a.jar'), 'jar');
  fs.writeFileSync(path.join(stage, 'libraries/x/lib.jar'), 'lib');
  fs.writeFileSync(path.join(stage, 'config/c.toml'), 'k = 1\n');
  fs.mkdirSync(path.join(stage, 'logs'));
  fs.writeFileSync(path.join(stage, 'logs/old.log'), 'stale');
  writeStamp(stage, NEO);
  return stage;
}

module.exports = { fakeStage, NEO, FORGE };
