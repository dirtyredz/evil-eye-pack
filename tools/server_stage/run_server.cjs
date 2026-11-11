'use strict';
// Disposable server copy shared by capture and test runners.
const fs = require('node:fs');
const path = require('node:path');
const { WORLD, isStageRuntime } = require('./stage_runtime.cjs');

// The run's own server copy. Jars are hard-linked (the server only reads them); everything else is copied.
function makeRunServer(stageDir, serverDir, { seed, port, heap }) {
  fs.mkdirSync(serverDir, { recursive: true });
  for (const e of fs.readdirSync(stageDir, { withFileTypes: true })) {
    if (isStageRuntime(e.name)) continue;
    const from = path.join(stageDir, e.name);
    const to = path.join(serverDir, e.name);
    if (e.name === 'mods' && e.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      for (const f of fs.readdirSync(from)) {
        try { fs.linkSync(path.join(from, f), path.join(to, f)); } catch { fs.copyFileSync(path.join(from, f), path.join(to, f)); }
      }
    } else fs.cpSync(from, to, { recursive: true });
  }
  fs.writeFileSync(path.join(serverDir, 'server.properties'), [
    `level-seed=${seed}`, 'online-mode=false', 'server-ip=127.0.0.1', `server-port=${port}`, `level-name=${WORLD}`,
    'enable-rcon=false', 'enable-query=false', 'max-tick-time=-1', 'motd=pack-test', 'spawn-protection=0', ''
  ].join('\n'));
  fs.writeFileSync(path.join(serverDir, 'user_jvm_args.txt'), `-Xmx${heap}\n-Xms1G\n`);
}

module.exports = { makeRunServer };
