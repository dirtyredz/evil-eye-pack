#!/usr/bin/env node
'use strict';
// Headless server compatibility smoke: boots the pack on a Forge 1.20.1 dedicated server.
// Usage: node tools/server_smoke/smoke.cjs [--pack pack.toml] [--timeout 600] [--port 25599]
//        [--heap 4G] [--out <dir>] [--cache <dir>]
//        [--analyze <run dir>]  re-report an existing run without booting
//        [--drop oculus,embeddium]  delete installed jars whose name contains a term (to find the next offender)
// Nothing here may show a window: nogui, windowsHide, piped stdio, no launcher, no client.
const fs = require('node:fs');
const path = require('node:path');
const { ARTIFACTS, JAVA } = require('./env.cjs');
const { ensureForgeBase, prepareRunDir, installPack, dropMods } = require('./setup.cjs');
const { analyze } = require('./log_report.cjs');
const { boot } = require('./boot.cjs');
const { crashReports, crashCauses, decide } = require('./verdict.cjs');

function parseArgs(argv) {
  const o = {
    pack: path.resolve(__dirname, '../../pack.toml'), timeout: 600, port: 25599, heap: '4G',
    cache: `${ARTIFACTS}/server-smoke/cache`, drop: '', analyze: '', out: `${ARTIFACTS}/server-smoke/runs`
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    if (!(k in o)) throw new Error(`unknown option ${argv[i]}`);
    o[k] = k === 'timeout' || k === 'port' ? Number(argv[++i]) : argv[++i];
  }
  o.pack = path.resolve(o.pack);
  return o;
}

function printGroups(title, list) {
  console.log(`${title}: ${list.length} group(s)`);
  for (const g of list.slice(0, 25)) {
    console.log(`  x${g.count}  ${g.signature.slice(0, 200)}${g.why ? `   [${g.why}]` : ''}`);
  }
  if (list.length > 25) console.log(`  ... ${list.length - 25} more in the log`);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const log = (m) => console.log(`[smoke] ${m}`);
  if (o.analyze) { report(o, path.resolve(o.analyze), null); return; }
  fs.mkdirSync(o.cache, { recursive: true });
  const runDir = path.join(o.out, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  let result;
  try {
    const base = await ensureForgeBase(o.cache, JAVA, log);
    prepareRunDir(base, runDir, o.port, o.heap);
    await installPack(runDir, o.pack, JAVA, o.cache, log);
    dropMods(runDir, o.drop.split(',').filter(Boolean), log);
    log(`mods installed: ${fs.readdirSync(path.join(runDir, 'mods')).filter((f) => f.endsWith('.jar')).length}`);
    result = await boot(runDir, o, log);
  } catch (e) {
    console.log(`FAIL (setup): ${e.message}`);
    process.exitCode = 2;
    return;
  }
  report(o, runDir, result);
}

function report(o, runDir, result) {
  const latest = path.join(runDir, 'logs/latest.log');
  const text = fs.existsSync(latest) ? fs.readFileSync(latest, 'utf8') : '';
  const knownNoise = JSON.parse(fs.readFileSync(path.join(__dirname, 'known_noise.json'), 'utf8'));
  const rep = analyze(text, knownNoise);
  const crashes = crashReports(runDir);
  const { pass, doneText } = decide({ rep, crashCount: crashes.length, boot: result, timeout: o.timeout });

  console.log(`\n${pass ? 'PASS' : 'FAIL'}  pack=${o.pack}`);
  console.log(`Done: ${doneText}`);
  console.log(`crash reports: ${crashes.length}   mod loading failed: ${rep.loadingFailed}`);
  for (const c of crashes) {
    console.log(`  ${c}`);
    for (const x of crashCauses(c)) console.log(`    ${x}`);
  }
  printGroups('known boot noise', rep.known);
  printGroups('NEW errors', rep.fresh);
  console.log(`logs: ${latest}\n      ${path.join(runDir, 'console.log')}\n      ${path.join(runDir, 'packwiz-install.log')}`);
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 2; });
