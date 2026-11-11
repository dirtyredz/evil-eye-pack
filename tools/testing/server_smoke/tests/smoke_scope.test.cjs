'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('smoke CLI owns installer processes and cleans them up on an install failure', async () => {
  const calls = [], logs = [], scope = { killAll: () => calls.push('cleanup') };
  const processStub = { argv: ['node', 'smoke'], once() {}, removeListener() {} };
  const modules = {
    '../../data_io/files.cjs': {}, 'node:fs': { mkdirSync() {} }, 'node:path': path,
    '../../runtime_env/env.cjs': { ARTIFACTS: '/fixture', JAVAS: {} },
    './runtime/runtime.cjs': { readRuntime: () => ({ id: 'fixture', java: 21 }), javaPaths: () => ({ java: 'java' }), checkJava() {} },
    './runtime/setup.cjs': { ensureLoaderBase: async (...args) => { calls.push(args[4]); return '/base'; }, prepareRunDir() {},
      installPack: async (...args) => { calls.push(args[5]); throw Error('fixture installation failure'); } },
    '../../runtime_env/procs.cjs': { scope: () => scope }, '../../runtime_env/staged_dir.cjs': { withStaged: async (_o, fn) => fn() }, './process/host_wait.cjs': { waitForServer: async () => {} },
    './log_report.cjs': {}, './process/boot.cjs': {}, './process/watchdog.cjs': {}, './verdict.cjs': {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../smoke.cjs'), 'utf8'), {
    require: id => { if (!(id in modules)) throw Error(id); return modules[id]; },
    __dirname, process: processStub, console: { log: x => logs.push(x), error: x => logs.push(String(x)) }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [scope, scope, 'cleanup']);
  assert.equal(processStub.exitCode, 2);
  assert.ok(logs.some(s => s.includes('fixture installation failure')));
});
