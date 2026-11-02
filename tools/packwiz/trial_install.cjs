'use strict';
// Owner's dedicated trial: packwiz copies cached artifacts as ordinary local files.
// No download metadata or URLs survive into the temporary installer input.
const fs = require('node:fs');
const path = require('node:path');
const P = require('./pack_index.cjs');
const { sha256 } = require('../data_io/files.cjs');
const { localPin, cachedLocal, verifyInstalledLocal } = require('./local_source.cjs');
const { resolvePinnedJar } = require('./pinned_jar.cjs');
const { noLinks } = require('../data_io/path_guard.cjs');
const { applyOwnedKeys } = require('./trial_owned_keys.cjs');
const env = require('../server_smoke/env.cjs');
const ROOT = path.resolve(__dirname, '../..');
const INSTANCE = 'C:/Users/dirty/MultiMC/instances/Evil Eye NeoForge Trial/.minecraft';

function instanceCfgValue(value) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw Error('Unsafe instance.cfg value');
  return value.replaceAll('\\', '/');
}

function setInstanceCfgValue(text, key, value) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw Error('Unsafe instance.cfg key');
  const line = new RegExp(`^${key}=[^\\r\\n]*$`, 'm');
  if (!line.test(text)) throw Error(`Missing Trial ${key}`);
  return text.replace(line, `${key}=${instanceCfgValue(value)}`);
}

function trialPreLaunchCommand(root, cache) {
  const script = path.join(root, 'scripts/migration/trial-walkthrough.ps1');
  if ([script, cache].some(s => /["\r\n]/.test(s))) throw Error('Unsafe launcher argument');
  return instanceCfgValue(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${script}" -Cache "${cache}"`);
}

function trialInstance(instance) {
  if (path.resolve(instance).toLowerCase() !== path.resolve(INSTANCE).toLowerCase()) throw Error('Only Evil Eye NeoForge Trial is allowed');
  noLinks(instance);
  return path.resolve(instance);
}

function prepareFiles(root, cache) {
  const indexText = fs.readFileSync(path.join(root, 'index.toml'), 'utf8');
  if (P.readPackIndexRef(fs.readFileSync(path.join(root, 'pack.toml'), 'utf8')).hash !== sha256(indexText)) throw Error('Stale pack index');
  const files = [], paths = new Set();
  for (const f of P.parseIndex(indexText).files) {
    if (path.isAbsolute(f.file) || f.file.split(/[\\/]/).includes('..')) throw Error('Unsafe index path');
    let file = f.file, bytes = fs.readFileSync(path.join(root, file));
    if (sha256(bytes) !== f.hash) throw Error('Stale index: ' + file);
    if (f.metafile) {
      const text = bytes.toString('utf8'), pin = P.readMetafileDownload(text);
      if (P.readMetafileSide(text) === 'server') continue;
      if (pin.mode === 'metadata:local') {
        const t = localPin(root, file, text);
        bytes = cachedLocal(t, path.join(cache, path.dirname(file)));
      } else bytes = resolvePinnedJar(text, [path.join(cache, path.dirname(file))], file).bytes;
      file = path.posix.join(path.posix.dirname(file), pin.filename);
    }
    if (paths.has(file.toLowerCase())) throw Error('Duplicate installed path: ' + file);
    paths.add(file.toLowerCase());
    files.push({ file, hash: sha256(bytes), bytes, preserve: f.preserve });
  }
  return files;
}

function verifyInstalledFiles(instance, files) {
  for (const f of files) {
    if (f.preserve) continue;
    const installed = path.join(instance, f.file);
    if (!fs.existsSync(installed) || sha256(fs.readFileSync(installed)) !== f.hash) {
      throw Error('Installed artifact differs: ' + f.file);
    }
  }
}

function writePack(root, overlay, files) {
  noLinks(overlay);
  if (fs.existsSync(overlay)) throw Error('Overlay already exists');
  fs.mkdirSync(overlay, { recursive: true });
  for (const f of files) {
    const dest = path.join(overlay, f.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes, { flag: 'wx' });
  }
  const index = P.formatIndex({ hashFormat: 'sha256', files });
  fs.writeFileSync(path.join(overlay, 'index.toml'), index);
  const pack = path.join(overlay, 'pack.toml');
  fs.writeFileSync(pack, P.setPackIndexHash(fs.readFileSync(path.join(root, 'pack.toml'), 'utf8'), sha256(index)));
  return pack;
}

// Shared install route (Trial and cutover): verify pack + cached bytes, then packwiz copies the
// local files into `instance` and sets the instance's PreLaunchCommand to `prelaunch`.
async function installPack({ instance, cache, dryRun, prelaunch, backupName, label }) {
  const cfg = path.resolve(instance, '../instance.cfg');
  noLinks(cfg);
  const original = fs.readFileSync(cfg, 'utf8');
  const installer = env.INSTALLER_JAR_SOURCES.find(f => fs.existsSync(f));
  if (!installer || !fs.existsSync(env.BOOTSTRAP)) throw Error('Cached installer/bootstrap missing; no downloads');
  const problems = require('./verify_hashes.cjs').verify(ROOT).problems;
  if (problems.length) throw Error(problems.join('\n'));
  const files = prepareFiles(ROOT, cache);
  for (const f of files) noLinks(path.join(instance, f.file));
  console.log(`Verified ${files.length} local files; destination ${instance}; no host or downloads.`);
  if (dryRun) { console.log(`Dry run: would install local files and set this ${label} prelaunch to the same command.`); return; }
  // This is the owner's client pre-launch path. It must not wait on unrelated JVMs.
  const scope = require('../server_smoke/procs.cjs').scope();
  const stop = () => scope.killAll();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const scratch = path.join(ROOT, '.tmp');
  fs.mkdirSync(scratch, { recursive: true });
  const run = fs.mkdtempSync(path.join(scratch, 'trial-install-'));
  try {
    const pack = writePack(ROOT, path.join(run, 'pack'), files);
    const result = await scope.run(env.JAVAS[21].java, ['-jar', env.BOOTSTRAP, '--bootstrap-main-jar', installer, '--bootstrap-no-update', '-g', '-s', 'client', pack], { cwd: instance, timeoutMs: 120000 });
    fs.writeFileSync(path.join(instance, 'packwiz-install.log'), result.out);
    console.log(result.out);
    if (result.code !== 0) throw Error('Headless installer exit ' + result.code);
    verifyInstalledLocal(ROOT, instance, 'client');
    verifyInstalledFiles(instance, files);
    for (const rel of applyOwnedKeys(instance)) console.log('Forced pack-owned keys into ' + rel);
    // Preserve the original once, beside owner-run logs. Never change another instance.
    const logs = path.join(ROOT, '.tmp/owner-runs'); fs.mkdirSync(logs, { recursive: true });
    const backup = path.join(logs, backupName);
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, { flag: 'wx' });
    fs.writeFileSync(cfg, setInstanceCfgValue(original, 'PreLaunchCommand', prelaunch));
    console.log(`Private jars verified. Launch ${label} in MultiMC; no client was started.`);
  } finally {
    scope.killAll(); process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    // run was made by mkdtemp directly under this worktree's .tmp, never user-provided.
    fs.rmSync(run, { recursive: true, force: true });
  }
}

async function main(argv) {
  let cache, dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') dryRun = true;
    else if (argv[i] === '--cache' && argv[i + 1]) cache = path.resolve(argv[++i]);
    else throw Error('Usage: trial_install.cjs --cache <cache root> [--dry-run]');
  }
  if (!cache) throw Error('A complete offline --cache is required');
  const instance = trialInstance(INSTANCE);
  await installPack({ instance, cache, dryRun, prelaunch: trialPreLaunchCommand(ROOT, cache), backupName: 'trial-instance-before.cfg', label: 'Evil Eye NeoForge Trial' });
}
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { installPack, instanceCfgValue, setInstanceCfgValue, trialPreLaunchCommand, prepareFiles, writePack, verifyInstalledFiles, trialInstance };
