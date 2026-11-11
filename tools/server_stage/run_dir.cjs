'use strict';
// A server run directory made from the loader base: libraries, server jar, eula, server.properties
// (port, seed) and JVM args.
const fs = require('node:fs');
const path = require('node:path');
const { readStamp } = require('../runtime_env/server/runtime.cjs');

// The run dir carries the base's runtime stamp (runtime.json) so the boot and any reuse verify it.
function prepareRunDir(base, runDir, port, heap, seed) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(path.join(base, 'libraries'), path.join(runDir, 'libraries'), { recursive: true });
  for (const f of fs.readdirSync(base)) {
    if (/^minecraft_server.*\.jar$/.test(f)) fs.copyFileSync(path.join(base, f), path.join(runDir, f));
  }
  fs.writeFileSync(path.join(runDir, 'eula.txt'), 'eula=true\n'); // owner-approved for this local test server
  fs.writeFileSync(path.join(runDir, 'server.properties'), [
    `level-seed=${seed}`, 'online-mode=false', 'server-ip=127.0.0.1', `server-port=${port}`, 'level-name=smoke-world',
    'enable-rcon=false', 'enable-query=false', 'max-tick-time=-1', 'motd=server-smoke', ''
  ].join('\n'));
  fs.writeFileSync(path.join(runDir, 'user_jvm_args.txt'), `-Xmx${heap}\n-Xms1G\n`);
  const stamp = readStamp(base);
  if (stamp) fs.writeFileSync(path.join(runDir, 'runtime.json'), JSON.stringify(stamp, null, 1) + '\n');
}

// The level-seed a run was started with, or null when the run has no server.properties or no seed line.
function readRunSeed(runDir) {
  const props = path.join(runDir, 'server.properties');
  const m = fs.existsSync(props) && /^level-seed=(.*)$/m.exec(fs.readFileSync(props, 'utf8'));
  return m ? m[1] : null;
}

module.exports = { prepareRunDir, readRunSeed };
