'use strict';
// Instrument an offline disposable copy; the existing smoke owns the JVM lifecycle.
const fs = require('node:fs');
const path = require('node:path');
const env = require('../../server_smoke/env.cjs');
const procs = require('../../server_smoke/procs.cjs');
const { boot } = require('../../server_smoke/boot.cjs');
const { prepare } = require('../../server_smoke/offline_server.cjs');
const { waitForServer } = require('../../server_smoke/host_wait.cjs');
const { localLock } = require('../../pack_test/session/lock.cjs');
const { worldKey, restoreWorld } = require('../../pack_test/session/world_cache.cjs');
const { WORLD } = require('../../pack_test/stage_runtime.cjs');

const LOG_CONFIG = `<?xml version="1.0" encoding="UTF-8"?>
<Configuration status="WARN"><Appenders>
<Console name="Console" target="SYSTEM_OUT"><PatternLayout pattern="[%d{ddMMMyyyy HH:mm:ss.SSS}] [%t/%level] [%logger/%marker]: %msg%n"/></Console>
<File name="Trace" fileName="logs/mod-map-trace.log"><PatternLayout pattern="[%d{ddMMMyyyy HH:mm:ss.SSS}] [%t/%level] [%logger/%marker]: %msg%n"/></File>
</Appenders><Loggers>
<Logger name="net.minecraftforge.fml.javafmlmod.FMLModContainer" level="trace" additivity="false"><AppenderRef ref="Trace"/></Logger>
<Root level="info"><AppenderRef ref="Console"/><AppenderRef ref="Trace"/></Root>
</Loggers></Configuration>`;

async function capture(root, cache, run, log, worldSource) {
  const scope = procs.scope();
  const stop = () => { scope.killAll(); process.exitCode = 2; };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let lock;
  const server = path.join(run, 'server');
  try {
    lock = localLock(path.join(env.ARTIFACTS, 'mod-map/server.lock'), { owner: run });
    // The ordinary world profile: this report measures the pack, not the flat showcase world.
    prepare(root, cache, server, { seed: '20261020', port: 25611, heap: '6G', profile: 'ordinary' });
    const key = worldKey(server, '20261020');
    const reused = restoreWorld(path.join(env.ARTIFACTS, 'pack-test/cache/worlds'), key, server);
    if (!reused) {
      if (!worldSource || !fs.existsSync(path.join(worldSource, 'level.dat'))) throw new Error('No matching cached world. Supply --world <cached world directory>; it is copied read-only, and its different mod-set provenance is recorded.');
      fs.cpSync(worldSource, path.join(server, WORLD), { recursive: true });
    }
    fs.mkdirSync(path.join(server, 'logs'), { recursive: true });
    fs.writeFileSync(path.join(server, 'mod-map-log4j.xml'), LOG_CONFIG);
    fs.appendFileSync(path.join(server, 'user_jvm_args.txt'), '-Dlog4j.configurationFile=mod-map-log4j.xml\n');
    // Reuse the pack-test registry collector, without the unrelated full acceptance suite.
    const scripts = path.join(server, 'kubejs/server_scripts/mod_map'); fs.mkdirSync(scripts, { recursive: true });
    fs.copyFileSync(path.join(root, 'tools/pack_test/probe/registries.js'), path.join(scripts, 'registries.js'));
    fs.writeFileSync(path.join(scripts, 'capture.js'), '// priority: -20\nServerEvents.loaded(event => { JsonIO.write("mod-map-registries.json", global.packTest.registries.collect(event.server).data); })\n');
    log('Local offline capture; cached world: ' + (reused ? key : worldSource + ' (different mod set)'));
    await waitForServer(scope, { log });
    const result = await boot(server, { priority: 'AboveNormal', sample: 10, silent: 180, timeout: 900,
      complete: () => fs.existsSync(path.join(server, 'mod-map-registries.json')), completeTimeout: 30 }, log, { scope });
    for (const [from, to] of [['logs/mod-map-trace.log', 'trace.log'], ['console.log', 'console.log'], ['mod-map-registries.json', 'registries.json']]) {
      if (fs.existsSync(path.join(server, from))) fs.copyFileSync(path.join(server, from), path.join(run, to));
    }
    const record = { ...result, world: { key, reused, source: reused ? 'matching pack-test cache' : worldSource }, host: require('node:os').hostname() };
    fs.writeFileSync(path.join(run, 'boot.json'), JSON.stringify(record, null, 2));
    if (result.wallSeconds === null || result.crashed || !result.completed) throw new Error('Boot incomplete; see ' + path.join(run, 'boot.json'));
    return record;
  } finally {
    scope.killAll(); lock?.release();
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    // Keep the disposable server and its full logs for auditing. No input is changed.
  }
}
module.exports = { capture, LOG_CONFIG };
