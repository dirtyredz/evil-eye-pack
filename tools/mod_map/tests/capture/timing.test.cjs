'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTiming } = require('../../capture/timing.cjs');

const line = (time, thread, message) => `[27Oct2026 ${time}] [${thread}/TRACE] [net.minecraftforge.fml.javafmlmod.FMLModContainer/LOADING]: ${message}`;
test('TRACE pairs parallel workers, repeated event identities, midnight and unknown intervals', () => {
  const trace = [line('23:59:59.900', 'w1', 'Loading mod instance a of type A'),
    line('23:59:59.910', 'w2', 'Loading mod instance b of type B'),
    line('23:59:59.950', 'w2', 'Loaded mod instance b of type B'),
    line('00:00:00.100', 'w1', 'Loaded mod instance a of type A').replace('27Oct', '28Oct'),
    line('00:00:00.101', 'main', 'Firing event for modid a : Event@abc').replace('27Oct', '28Oct'),
    line('00:00:00.121', 'main', 'Fired event for modid a : Event@abc').replace('27Oct', '28Oct'),
    line('00:00:00.122', 'main', 'Firing event for modid missing : Event@def').replace('27Oct', '28Oct'),
    line('00:00:01.000', 'main', 'Done (1.0s)!').replace('27Oct', '28Oct')].join('\n');
  const t = parseTiming(trace);
  assert.equal(t.mods.a.ms, 220); assert.equal(t.mods.b.ms, 40);
  assert.equal(t.mods.missing, undefined); assert.equal(t.warnings.length, 1);
  assert.equal(t.logToDoneSeconds, 1.1);
});
test('only the server Done marker ends the measured window', () => {
  const t = parseTiming([line('00:00:00.000', 'w1', 'Loading mod instance a of type A'),
    line('00:00:00.500', 'main', 'Done (loading resources)'),
    line('00:00:00.900', 'w1', 'Loaded mod instance a of type A')].join('\n'));
  assert.equal(t.logToDoneSeconds, null);
  assert.equal(t.mods.a.ms, 900);
});
