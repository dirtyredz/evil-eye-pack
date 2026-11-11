'use strict';
// Pack-test probe injection into a disposable server.
const fs = require('node:fs');
const path = require('node:path');

const PROBE_DIR = path.join(__dirname, '../probe');

// Copies the probe scripts into the run's server and writes its inputs. Never touches a checkout.
// `startup_*.js` go to startup_scripts (KubeJS 2101 only lets startup scripts set globals); the rest
// are server scripts.
function injectProbe(serverDir, input) {
  const scripts = path.join(serverDir, 'kubejs/server_scripts/pack_test');
  const startup = path.join(serverDir, 'kubejs/startup_scripts/pack_test');
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(startup, { recursive: true });
  for (const f of fs.readdirSync(PROBE_DIR).filter((x) => x.endsWith('.js'))) fs.copyFileSync(path.join(PROBE_DIR, f), path.join(f.startsWith('startup_') ? startup : scripts, f));
  fs.mkdirSync(path.join(serverDir, 'pack_test/in'), { recursive: true });
  fs.mkdirSync(path.join(serverDir, 'pack_test/out'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'pack_test/in/run.json'), JSON.stringify(input));
}

module.exports = { injectProbe };
