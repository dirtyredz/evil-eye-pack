'use strict';
// Pair exact Forge TRACE boundaries by mod + thread + phase/event identity.
// Never infer a duration from neighbouring log messages or count missing data as zero.
const { DONE_RE } = require('../../server_smoke/log_report.cjs');

function parseTiming(text) {
  const pending = new Map(), mods = {}, warnings = [];
  let first = null, done = null;
  for (const line of text.split(/\r?\n/)) {
    const match = /^\[(\d{2})([A-Za-z]{3})(\d{4}) (\d\d:\d\d:\d\d\.\d{3})\] \[([^/]+)\/\w+\] .*?: (.*)$/.exec(line);
    if (!match) continue;
    const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[2]);
    const [h, m, s] = match[4].split(':').map(Number);
    const time = Date.UTC(+match[3], month, +match[1], h, m, Math.floor(s), Math.round((s % 1) * 1000));
    if (first === null) first = time;
    const msg = match[6];
    if (DONE_RE.test(msg)) { done = time; break; }
    if (!line.includes('net.minecraftforge.fml.javafmlmod.FMLModContainer/')) continue;
    let p, start, id, phase;
    if ((p = /^(Loading|Loaded) mod instance (\S+) of type /.exec(msg))) {
      start = p[1] === 'Loading'; id = p[2]; phase = 'constructor';
    } else if ((p = /^(Injecting|Completed) Automatic event subscribers for (\S+)/.exec(msg))) {
      start = p[1] === 'Injecting'; id = p[2]; phase = 'subscribers';
    } else if ((p = /^(Firing|Fired) event for modid (\S+) : (.+)$/.exec(msg))) {
      start = p[1] === 'Firing'; id = p[2]; phase = p[3];
    } else continue;
    const key = JSON.stringify([id, match[5], phase]);
    if (start) {
      if (pending.has(key)) warnings.push('Duplicate start: ' + key);
      pending.set(key, time);
    } else if (pending.has(key)) {
      const ms = time - pending.get(key); pending.delete(key);
      if (ms < 0) { warnings.push('Negative interval: ' + key); continue; }
      const mod = mods[id] ||= { ms: 0, intervals: 0, phases: {} };
      const label = phase.replace(/@[\da-f]+$/i, '');
      mod.ms += ms; mod.intervals++; mod.phases[label] = (mod.phases[label] || 0) + ms;
    } else warnings.push('Unmatched end: ' + key);
  }
  for (const key of pending.keys()) warnings.push('Unmatched start: ' + key);
  return { mods, warnings, logToDoneSeconds: done !== null ? (done - first) / 1000 : null };
}
module.exports = { parseTiming };
