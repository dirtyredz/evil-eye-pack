import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runScript } from '../../script-run/script-run.mjs';
import scanner from './scan.cjs';
await runScript({ name:'library-closure', from:import.meta.url }, async log => {
 const args=log.args; const value=k=>args[args.indexOf(k)+1];
 if(!args.includes('--out') || !args.includes('--cache')) throw Error('Required: --out <directory> --cache <mods directory>');
 if(log.dryRun) return;
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
 const out=path.resolve(value('--out'));
 const result=scanner.audit(root,[path.resolve(value('--cache'))]);
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'library-closure.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({complete:result.complete,totals:result.totals,consumers:result.consumers,errors:result.errors},null,2));
 if(!result.complete || result.consumers.ipn.some(c=>c.referringClasses || c.dependencies.some(d=>d.dependency.type==='required'))) throw Error('Incomplete or unsafe IPN removal closure');
});
