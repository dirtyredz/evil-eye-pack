import fs from 'node:fs';
import path from 'node:path';
import { runScript } from '../../script-run/script-run.mjs';
import guards from '../../data_io/path_guard.cjs';
import snapshots from '../../testing/world_trial/snapshot.cjs';
import inventory from '../../testing/world_trial/inventory.cjs';
import evidence from './wave7_evidence.cjs';

await runScript({ name:'wave7-evidence', from:import.meta.url }, async log => {
  const options = {};
  for (let i = 0; i < log.args.length; i += 2) {
    const key = log.args[i];
    if (!['--job'].includes(key) || !log.args[i+1] || options[key]) throw Error('Expected --job <snapshot job>');
    options[key] = log.args[i+1];
  }
  if (!options['--job']) throw Error('Required --job <snapshot job>');
  const job = path.resolve(options['--job']);
  guards.artifactJob(job);
  const out = path.join(job, 'wave7-evidence.json');
  guards.output(out, job);
  const recordPath = path.join(job, 'source-manifest.json');
  guards.noLinks(recordPath);
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  if (path.resolve(record.snapshot) !== path.join(job, 'snapshot')) throw Error('Snapshot must belong to this job');
  if (log.dryRun) return;
  snapshots.verify(record.source, record.files);
  snapshots.verify(record.snapshot, record.files);
  const result = evidence.report(record.snapshot);
  snapshots.verify(record.source, record.files);
  snapshots.verify(record.snapshot, record.files);
  fs.writeFileSync(out, inventory.json(result) + '\n', {flag:'wx'});
  console.log(inventory.json({complete:result.complete, mounted:result.mounted.length,
    polymorph:result.polymorph.length, actualDiagonalBlocks:result.actualDiagonalBlocks,
    errors:result.errors, unsupportedFiles:result.unsupportedFiles}));
  if (!result.complete) throw Error('Incomplete wave-7 evidence; no absence or removal claim permitted');
});
