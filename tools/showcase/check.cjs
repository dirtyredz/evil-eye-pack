'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { setTimeout: sleep } = require('node:timers/promises');
const { boot } = require('../server_smoke/boot.cjs');
const procs = require('../server_smoke/procs.cjs');
const env = require('../server_smoke/env.cjs');
const { verify } = require('../packwiz/verify_hashes.cjs');
const { localLock } = require('../pack_test/session/lock.cjs');
const { checkDestination, runMeta } = require('../pack_test/session/run_meta.cjs');
const { collectEvidence } = require('../pack_test/session/execute.cjs');
const { prepare } = require('./offline.cjs');
const { normalize } = require('../server_smoke/log_report.cjs');

function sections(root) {
  const names = fs.readdirSync(path.join(root, 'kubejs/server_scripts/showcase/sections')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).sort();
  for (const name of names) if (!fs.existsSync(path.join(__dirname, 'checks', name + '.js'))) throw new Error('Missing check module: ' + name);
  return names;
}
function logGroups(text, serverDir) {
  if (serverDir) {
    const forward = serverDir.replace(/\\/g, '/');
    text = text.split(forward).join('<server>').split(forward.replace(/\//g, '\\')).join('<server>');
  }
  const groups = {};
  for (const line of text.split(/\r?\n/)) if (/\/(WARN|ERROR|FATAL)\]/.test(line)) {
    const key = normalize(line.replace(/@[0-9a-f]{1,8}\b/gi, '@<identity>')); groups[key] = (groups[key] || 0) + 1;
  }
  return groups;
}
async function waitForServer(scope, { now = Date.now, wait = sleep, log = console.log, budgetMs = 45 * 60000 } = {}) {
  const deadline = now() + budgetMs;
  for (;;) {
    if (scope.cancelled) throw new Error('Interrupted while waiting for the host');
    const r = await scope.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^javaw?\\.exe$' -and $_.CommandLine -match 'forge|minecraft|BootstrapLauncher' } | Select-Object ProcessId,@{Name='CommandLine';Expression={$_.CommandLine.Substring(0,[Math]::Min(250,$_.CommandLine.Length))}} | ConvertTo-Json -Compress"], { timeoutMs: 60000 });
    if (r.code === 0 && !r.out.trim()) return;
    const reason = r.code === 0 ? 'Another Minecraft JVM is running: ' : 'Could not inspect running servers: ';
    if (now() >= deadline) throw new Error('Host unavailable after 45 minutes. ' + reason + r.out.slice(0, 500));
    log('Waiting. ' + reason + r.out.trim().slice(0, 500));
    await wait(Math.min(60000, deadline - now()));
  }
}
async function main(argv) {
  const root = path.resolve(__dirname, '../..');
  const option = name => { const i = argv.indexOf(name); return i < 0 ? null : argv[i + 1]; };
  const baseline = option('--baseline-ref');
  const selected = argv[0] === '--all' ? sections(root) : [argv[0]];
  if (!baseline && selected.some(n => !sections(root).includes(n))) throw new Error('Usage: node tools/showcase/check.cjs <section|--all> [--cache <prepared server>] [--out <new run dir>] [--compare <baseline run dir>]');
  const cache = path.resolve(option('--cache') || process.env.SHOWCASE_CACHE || path.join(env.ARTIFACTS, 'pack-test/stage/server'));
  const out = path.resolve(option('--out') || path.join(env.ARTIFACTS, 'showcase', 'run-' + Date.now()));
  const checkouts = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, windowsHide: true, encoding: 'utf8' }).split(/\r?\n/).filter(l => l.startsWith('worktree ')).map(l => l.slice(9));
  checkDestination(out, { artifacts: env.ARTIFACTS, checkouts });
  if (out.toLowerCase().startsWith(cache.toLowerCase() + path.sep)) throw new Error('Output must not be inside the input cache');
  if (fs.existsSync(out)) throw new Error('Use a new output directory: ' + out);
  fs.mkdirSync(out, { recursive: true });
  const scope = procs.scope();
  const interrupt = () => { scope.killAll(); process.exitCode = 2; };
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  let lock;
  try {
    // Serializes showcase invocations; process inventory also catches other harnesses.
    lock = localLock(path.join(env.ARTIFACTS, 'showcase/server.lock'), { owner: out });
    let packRoot = root;
    if (baseline) {
      packRoot = path.join(out, 'source'); fs.mkdirSync(packRoot);
      execFileSync('git', ['archive', '--format=tar', '--output=' + path.join(out, 'source.tar'), baseline], { cwd: root, windowsHide: true });
      execFileSync('tar', ['-xf', path.join(out, 'source.tar'), '-C', packRoot], { windowsHide: true });
      execFileSync('git', ['init', '--quiet'], { cwd: packRoot, windowsHide: true });
    }
    const verified = verify(packRoot);
    if (verified.problems.length) throw new Error(verified.problems.join('\n'));
    const server = path.join(out, 'server');
    const pins = prepare(packRoot, cache, server, { seed: '20261020', port: 25609, heap: '6G' });
    fs.writeFileSync(path.join(out, 'inputs.json'), JSON.stringify({ ...runMeta(path.join(root, 'pack.toml')), root: packRoot, baseline, indexHash: verified.indexHash, selected, pins }, null, 2));
    if (!baseline) {
      const dest = path.join(server, 'kubejs/server_scripts/showcase_check'); fs.mkdirSync(dest, { recursive: true });
      for (const file of ['harness.js', ...selected.map(n => 'checks/' + n + '.js')]) fs.copyFileSync(path.join(__dirname, file), path.join(dest, path.basename(file)));
      fs.writeFileSync(path.join(dest, 'selection.js'), '// priority: -15\nglobal.evilEyeShowcaseCheckSelection = ' + JSON.stringify(selected) + '\n');
    }
    const consoleFile = path.join(server, 'console.log');
    const readLog = () => fs.existsSync(consoleFile) ? fs.readFileSync(consoleFile, 'utf8') : '';
    await waitForServer(scope);
    let result;
    try {
      result = await boot(server, { priority: 'AboveNormal', sample: 10, silent: 180, timeout: 900,
        ...(!baseline ? { complete: () => readLog().includes('SHOWCASE_CHECK COMPLETE '), completeTimeout: 300 } : {}) }, console.log, { scope });
    } finally { collectEvidence(server, path.join(out, 'evidence')); }
    const log = readLog(), match = /SHOWCASE_CHECK COMPLETE (\{[^\r\n]*\})/.exec(log);
    const assertions = match ? JSON.parse(match[1]) : null;
    const groups = logGroups(log, server);
    const compare = option('--compare');
    const oldGroups = compare ? logGroups(fs.readFileSync(path.join(compare, 'evidence/logs/console.log'), 'utf8'), path.resolve(compare, 'server')) : null;
    const newLogGroups = oldGroups ? Object.keys(groups).filter(k => !oldGroups[k]) : [];
    const scriptErrors = log.split(/\r?\n/).filter(l => /\/(ERROR|FATAL)\]/.test(l) && /showcase|showcase_check/.test(l));
    const ok = result.wallSeconds !== null && !result.crashed && !result.timedOut && !scriptErrors.length && !newLogGroups.length && (baseline || (result.completed && assertions?.ok));
    const report = { ok: !!ok, boot: result, assertions, logGroups: groups, newLogGroups, scriptErrors, comparedTo: compare };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return ok ? 0 : 1;
  } finally {
    scope.killAll(); lock?.release();
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
  }
}
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(e => { console.error(e.stack); process.exitCode = 2; });
module.exports = { sections, logGroups, waitForServer };
