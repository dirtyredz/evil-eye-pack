'use strict';
// Shell bridge: one scalar from env, with explicit FIXED.* keys for install defaults.
const env = require('./env.cjs');
function main(args) {
  if (args.length !== 1) throw Error('Usage: node tools/runtime_env/paths.cjs <key>');
  let value = env;
  for (const part of args[0].split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) throw Error('Unknown path key: ' + args[0]);
    value = value[part];
  }
  if (typeof value !== 'string' || !value || /[\r\n]/.test(value)) throw Error('Expected a nonempty scalar path: ' + args[0]);
  process.stdout.write(value + '\n');
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
