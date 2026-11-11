'use strict';
// The loader server installed once into <cache>/loader-base/<runtime id> (Forge or NeoForge, per the
// pack's runtime descriptor); its libraries are reused by every run.
const fs = require('node:fs');
const path = require('node:path');
const { writeStamp, readStamp, assertStamp } = require('../runtime_env/server/runtime.cjs');
const { verifiedInstaller } = require('./installer.cjs');

// A base stamped for another runtime is never reused. scope owns the installer process.
// deps.http: injected fetch (tests).
async function ensureLoaderBase(cache, runtime, java, log, scope, deps = {}) {
  const base = path.join(cache, 'loader-base', runtime.id);
  const argsFile = path.join(base, runtime.argsFile);
  if (fs.existsSync(argsFile) && readStamp(base)) { assertStamp(base, runtime, 'loader base'); return base; }
  fs.mkdirSync(base, { recursive: true });
  const installer = await verifiedInstaller(cache, runtime, log, deps.http);
  log(`installing the ${runtime.id} server (first run for this runtime only)`);
  const r = await scope.run(java, ['-jar', installer, '--installServer', base], { cwd: base });
  const installLog = path.join(cache, `${runtime.id}-install.log`);
  fs.writeFileSync(installLog, r.out);
  if (!fs.existsSync(argsFile)) throw new Error(`${runtime.loader} install failed (see ${installLog})`);
  writeStamp(base, runtime);
  return base;
}

module.exports = { ensureLoaderBase };
