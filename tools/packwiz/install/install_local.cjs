#!/usr/bin/env node
'use strict';
// Dev/trial-only prelaunch entry. The instance must be dedicated to this checkout.
const path = require('node:path');
const fs = require('node:fs');
const env = require('../../testing/server_smoke/runtime/env.cjs');
const procs = require('../../testing/server_smoke/process/procs.cjs');
const { withLocalPack, verifyInstalledLocal } = require('./local_source.cjs');
const { verify } = require('../verify_hashes.cjs');
const { assertPinTarget } = require('./instance_targets.cjs');

async function main(argv) {
  if (argv.length !== 2 || argv[0] !== '--instance') throw new Error('usage: node tools/packwiz/install/install_local.cjs --instance <dedicated trial .minecraft>');
  const root = path.resolve(__dirname, '../../..'), instance = path.resolve(argv[1]);
  assertPinTarget(instance);
  if (!fs.existsSync(instance)) throw new Error('Trial instance directory does not exist');
  const problems = verify(root).problems;
  if (problems.length) throw new Error(problems.join('\n'));
  const installer = env.INSTALLER_JAR_SOURCES.find(f => fs.existsSync(f));
  if (!installer) throw new Error('Cached packwiz installer missing (no download)');
  const scope = procs.scope();
  const interrupt = () => scope.killAll();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    await withLocalPack(path.join(root, 'pack.toml'), env.MIGRATION_MODS, async pack => {
      const r = await scope.run(env.JAVAS[21].java, ['-jar', env.BOOTSTRAP, '--bootstrap-main-jar', installer, '--bootstrap-no-update', '-g', '-s', 'both', pack], { cwd: instance });
      fs.writeFileSync(path.join(instance, 'packwiz-install.log'), r.out);
      if (r.code !== 0) throw new Error(`packwiz exited ${r.code}: ${r.out}`);
      verifyInstalledLocal(root, instance);
      console.log(r.out);
    });
  } finally { scope.killAll(); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exitCode = 1; });
