import { runScript } from '../script-run/script-run.mjs';
import main from './run.cjs';
await runScript({ name: 'mod-map', from: import.meta.url }, async log => {
  await main.run(log.args, { dryRun: log.dryRun, log: message => { console.log(log.clean(message)); log.write(message); } });
});
