'use strict';
// Neutral install route shared by the Trial and Stable targets: packwiz copies hash-verified cached
// artifacts as ordinary local files. No download metadata or URLs survive into the temporary
// installer input. Target modules (trial_target.cjs, stable_target.cjs) own the instance rules.
const fs = require('node:fs');
const path = require('node:path');
const P = require('../pack_index.cjs');
const { sha256 } = require('../../data_io/files.cjs');
const { verifyInstalledLocal } = require('./local_source.cjs');
const { clientArtifacts } = require('./client_artifacts.cjs');
const { noLinks } = require('../../data_io/path_guard.cjs');
const { applyOwnedKeys } = require('./pack_owned_keys.cjs');
const env = require('../../runtime_env/env.cjs').FIXED;
const ROOT = path.resolve(__dirname, '../../..');

function instanceCfgValue(value) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw Error('Unsafe instance.cfg value');
  return value.replaceAll('\\', '/');
}

function setInstanceCfgValue(text, key, value) {
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key)) throw Error('Unsafe instance.cfg key');
  const line = new RegExp(`^${key}=[^\\r\\n]*$`, 'm');
  if (!line.test(text)) throw Error(`Missing instance.cfg key ${key}`);
  return text.replace(line, `${key}=${instanceCfgValue(value)}`);
}

function prepareFiles(root, cache) {
  const files = [];
  for (const artifact of clientArtifacts(root)) {
    const bytes = artifact.resolve(path.join(cache, artifact.dir)).bytes;
    files.push({ file: artifact.installedFile, hash: sha256(bytes), bytes, preserve: artifact.preserve, sourceMetafile: artifact.sourceMetafile });
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

// Keep original metadata provenance: converted jar entries must still fail strict verification.
function restorePackFiles(instance, files, run, log = console.log) {
  const restored = [];
  for (const f of files) {
    if (f.preserve || f.sourceMetafile) continue;
    const installed = path.join(instance, f.file);
    noLinks(installed);
    const previous = fs.existsSync(installed) ? fs.readFileSync(installed) : null;
    if (previous !== null && sha256(previous) === f.hash) continue;
    if (previous !== null) {
      const backup = path.join(run, 'drift-backup', f.file);
      noLinks(backup);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, previous, { flag: 'wx' });
    }
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.writeFileSync(installed, f.bytes);
    restored.push(f.file);
    log('Restored pack-owned file: ' + f.file);
  }
  return restored;
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

// Install route (Trial and Stable targets): verify pack + cached bytes, then packwiz copies the
// local files into `instance` and sets the instance's PreLaunchCommand to `prelaunch`.
async function installPack({ instance, cache, dryRun, prelaunch, backupName, label }) {
  const cfg = path.resolve(instance, '../instance.cfg');
  noLinks(cfg);
  const original = fs.readFileSync(cfg, 'utf8');
  const installer = env.INSTALLER_JAR_SOURCES.find(f => fs.existsSync(f));
  if (!installer || !fs.existsSync(env.BOOTSTRAP)) throw Error('Cached installer/bootstrap missing; no downloads');
  const problems = require('../verify_hashes.cjs').verify(ROOT).problems;
  if (problems.length) throw Error(problems.join('\n'));
  const files = prepareFiles(ROOT, cache);
  for (const f of files) noLinks(path.join(instance, f.file));
  console.log(`Verified ${files.length} local files; destination ${instance}; no host or downloads.`);
  if (dryRun) { console.log(`Dry run: would install local files and set this ${label} prelaunch to the same command.`); return; }
  // This is the owner's client pre-launch path. It must not wait on unrelated JVMs.
  const scope = require('../../runtime_env/procs.cjs').scope();
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
    restorePackFiles(instance, files, run);
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
    fs.rmSync(path.join(run, 'pack'), { recursive: true, force: true });
    if (!fs.existsSync(path.join(run, 'drift-backup'))) fs.rmdirSync(run);
    else console.log('Retained config drift backups: ' + path.join(run, 'drift-backup'));
  }
}

module.exports = { installPack, instanceCfgValue, setInstanceCfgValue, prepareFiles, writePack, verifyInstalledFiles, restorePackFiles };
