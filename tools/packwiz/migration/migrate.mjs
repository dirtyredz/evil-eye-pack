// NeoForge migration lock tooling (see docs/neoforge-migration.md). Runs through script-run:
//   node tools/packwiz/migration/migrate.mjs resolve|check|apply [--write] [--dry-run] [--lock f] [--cache d] [--job d]
// apply is a dry run unless --write is given.
import { runScript } from '../../script-run/script-run.mjs';
import migration from './run.cjs';
await runScript({ name: 'packwiz-migrate', from: import.meta.url }, async log => {
  await migration.run(log.args, { dryRun: log.dryRun, log: message => { console.log(log.clean(message)); log.write(message); } });
});
