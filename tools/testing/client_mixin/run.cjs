'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { stage } = require('./stage.cjs');
const { scope } = require('../../runtime_env/procs.cjs');
const { waitForServer } = require('../server_smoke/process/host_wait.cjs');
const { verdict } = require('./verdict.cjs');
const { loadAllowlist } = require('./allowlist.cjs');
const { output, inside, noLinks } = require('../../data_io/path_guard.cjs');

async function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--out', '--cache', '--launcher', '--jdk', '--exclude'].includes(argv[i]) || !argv[i+1]) throw Error('Expected --out, --cache, --launcher, --jdk, or --exclude with a value');
    options[argv[i].slice(2)] = argv[i+1];
  }
  const root = path.resolve(__dirname, '../../..');
  const allowlist = loadAllowlist(path.join(__dirname, 'allowlist.json'));
  if (!options.out || !options.cache) throw Error('--out and --cache are required');
  const out = path.resolve(options.out);
  const jobs = path.resolve(require('../../runtime_env/env.cjs').ARTIFACTS, 'jobs');
  output(out, jobs);
  for (const input of [root, options.cache, options.launcher || 'C:/Users/dirty/MultiMC']) {
    noLinks(input);
    if (inside(out, input) || inside(input, out)) throw Error('Output overlaps an input');
  }
  if (fs.existsSync(out)) throw Error('Output already exists: ' + out);
  const jdk = options.jdk || 'C:/Users/dirty/.local-state/tools/evil-eye-pack/temurin-21';
  const s = scope();
  const stop = () => s.killAll();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.mkdirSync(out);
    const { version, libraries, cp } = stage(root, out, options.cache, options.launcher || 'C:/Users/dirty/MultiMC', options.exclude);
    const run = async (exe, args) => {
      const r = await s.run(path.join(jdk, 'bin', exe + '.exe'), args, { cwd: out, timeoutMs: 60000 });
      if (r.code !== 0) throw Error(r.out);
    };
    const classes = path.join(out, 'classes');
    fs.mkdirSync(classes);
    await run('javac', ['-proc:none', '-cp', cp.join(path.delimiter), '-d', classes,
      ...['probe/ClientMixinLaunch.java', 'probe/TargetVerifier.java', 'tests/VerifierFixture.java'].map(f => path.join(__dirname, f))]);
    fs.mkdirSync(path.join(classes, 'META-INF/services'), { recursive: true });
    fs.writeFileSync(path.join(classes, 'META-INF/services/cpw.mods.modlauncher.api.ILaunchHandlerService'), 'packcheck.ClientMixinLaunch\n');
    const probe = path.join(out, 'client-audit.jar');
    await run('jar', ['--create', '--file', probe, '-C', classes, '.']);
    const values = { library_directory: libraries.replaceAll('\\', '/'), classpath_separator: path.delimiter, version_name: version.id };
    const jvm = version.arguments.jvm.map(a => a.replace(/\$\{([^}]+)\}/g, (_, key) => values[key]));
    fs.mkdirSync(path.join(out, 'tmp'));
    const args = ['-Xmx4G', '-Xverify:all', '-Djava.awt.headless=true', '-Djava.io.tmpdir=' + path.join(out, 'tmp'), '-Dmixin.debug.verify=true', ...jvm,
      '-cp', [...cp, probe].join(path.delimiter), version.mainClass,
      ...version.arguments.game.map(a => a === 'forgeclient' ? 'packclientaudit' : a), '--gameDir', path.join(out, 'game')];
    fs.writeFileSync(path.join(out, 'java.args'), args.map(a => '"' + a.replaceAll('\\', '/').replaceAll('"', '\\"') + '"').join('\n'));
    await waitForServer(s);
    const fixture = await s.run(path.join(jdk, 'bin/java.exe'), ['-Xverify:all', '-cp', classes, 'packcheck.VerifierFixture'], { cwd: out, timeoutMs: 30000 });
    fs.writeFileSync(path.join(out, 'fixture.log'), fixture.out);
    if (fixture.code !== 0 || !fixture.out.includes('FIXTURE PASS:')) throw Error('Verifier regression failed: ' + fixture.out);
    console.log('Starting isolated CLIENT audit: ' + out);
    const started = Date.now();
    // Keep "minecraft" on the real command line: shared host guards cannot inspect @argfiles.
    const result = await s.run(path.join(jdk, 'bin/java.exe'), ['-Dpackcheck.minecraft.clientAudit=true', '@' + path.join(out, 'java.args')], { cwd: path.join(out, 'game'), timeoutMs: 300000 });
    fs.writeFileSync(path.join(out, 'console.log'), result.out);
    const summary = result.out.split(/\r?\n/).filter(l => /PACK_AUDIT (CLIENT|CONFIGS|FAILED|UNHANDLED|COMPLETE)|VerifyError|Bad type on operand stack|@Mixin target .* was not found/.test(l));
    console.log(summary.join('\n'));
    const report = { ...verdict(result, allowlist), jvmExit: result.code, seconds: (Date.now()-started)/1000, excluded: options.exclude || null };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${['PASS', 'FAIL', 'INCOMPLETE'][report.code]} (exit ${report.code}, JVM ${result.code}); ${report.seconds}s; log: ${out}/console.log`);
    process.exitCode = report.code;
  } finally {
    s.killAll(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  }
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e); process.exitCode = 2; });
module.exports = { main };
