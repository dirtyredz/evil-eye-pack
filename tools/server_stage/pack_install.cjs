'use strict';
// The pack's `-s server` packwiz install into a server directory, verified against the local pack.
const fs = require('node:fs');
const path = require('node:path');
const { BOOTSTRAP, INSTALLER_JAR_SOURCES, MIGRATION_MODS } = require('../runtime_env/env.cjs');

async function installPack(runDir, packToml, java, cache, log, scope) {
  const { withLocalPack, verifyInstalledLocal } = require('../packwiz/install/local_source.cjs');
  const cachedInstaller = path.join(cache, 'packwiz-installer.jar');
  if (!fs.existsSync(cachedInstaller)) {
    const src = INSTALLER_JAR_SOURCES.find((p) => fs.existsSync(p));
    if (src) fs.copyFileSync(src, cachedInstaller);
  }
  const args = ['-jar', BOOTSTRAP];
  if (fs.existsSync(cachedInstaller)) args.push('--bootstrap-main-jar', cachedInstaller);
  args.push('--bootstrap-no-update', '-g', '-s', 'server');
  log('packwiz install (-s server)');
  const r = await withLocalPack(packToml, MIGRATION_MODS, overlay => scope.run(java, [...args, overlay], { cwd: runDir }));
  fs.writeFileSync(path.join(runDir, 'packwiz-install.log'), r.out);
  if (r.code !== 0) throw new Error(`packwiz install exited ${r.code} (see ${path.join(runDir, 'packwiz-install.log')})`);
  verifyInstalledLocal(path.dirname(path.resolve(packToml)), runDir, 'server');
}

module.exports = { installPack };
