'use strict';
// Installed-byte policy shared by verification, repair and the read-only prelaunch preview.
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../../data_io/files.cjs');
const { noLinks } = require('../../data_io/path_guard.cjs');

const DRIFT_BACKUP_DIR = 'installer-drift';
const DRIFT_BACKUP_LIMIT = 5;
const isStrictlyPackOwned = file => !file.preserve;

function verifyInstalledFiles(instance, files) {
  for (const f of files) {
    if (!isStrictlyPackOwned(f)) continue;
    const installed = path.join(instance, f.file);
    noLinks(installed);
    if (!fs.existsSync(installed) || sha256(fs.readFileSync(installed)) !== f.hash) {
      throw Error('Installed artifact differs: ' + f.file);
    }
  }
}


// Metadata-derived artifacts (jars, packs) are verified but never repaired here.
function packFileDrift(instance, files) {
  const drift = [];
  for (const f of files) {
    if (!isStrictlyPackOwned(f) || f.sourceMetafile) continue;
    const installed = path.join(instance, f.file);
    noLinks(installed);
    const previous = fs.existsSync(installed) ? fs.readFileSync(installed) : null;
    if (previous === null || sha256(previous) !== f.hash) drift.push({ ...f, previous });
  }
  return drift;
}

function previewPackFiles(instance, files, log = console.log) {
  const paths = packFileDrift(instance, files).map(f => f.file);
  for (const file of paths) log('Would restore pack-owned file: ' + file);
  return paths;
}

// A canonical instance identity keeps independent rehearsal/Stable histories separate.
function driftBackupDirectory(instance, scratch) {
  const identity = fs.realpathSync.native(instance).replaceAll('\\', '/');
  return path.join(scratch, DRIFT_BACKUP_DIR, sha256(process.platform === 'win32' ? identity.toLowerCase() : identity));
}

function generationsIn(directory) {
  const generations = fs.readdirSync(directory, { withFileTypes: true })
    .filter(e => e.isDirectory() && /^run-\d{12}-/.test(e.name))
    .map(e => path.join(directory, e.name));
  for (const dir of generations) noLinks(dir);
  return generations.sort().reverse();
}

function pruneBackups(directory, current) {
  const old = generationsIn(directory).filter(dir => dir !== current);
  for (const dir of old.slice(DRIFT_BACKUP_LIMIT - (current ? 1 : 0))) {
    // Each path is an immediate generated child of this instance's guarded backup directory.
    fs.rmSync(dir, { recursive: true });
  }
}

function restorePackFiles(instance, files, scratch, log = console.log) {
  const drift = packFileDrift(instance, files);
  const directory = driftBackupDirectory(instance, scratch);
  noLinks(directory);
  const state = path.join(directory, 'last-restored.json');
  noLinks(state);
  const previous = fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, 'utf8')) : [];
  if (!Array.isArray(previous) || previous.some(p => typeof p !== 'string')) throw Error('Invalid drift history: ' + state);
  if (!drift.length && !fs.existsSync(directory)) return [];
  fs.mkdirSync(directory, { recursive: true });
  let generation;
  // Back up all old bytes before touching any installed file.
  if (drift.some(f => f.previous !== null)) {
    const latest = generationsIn(directory)[0];
    const sequence = latest ? Number(path.basename(latest).split('-')[1]) + 1 : 1;
    generation = fs.mkdtempSync(path.join(directory, 'run-' + String(sequence).padStart(12, '0') + '-'));
    for (const f of drift) {
      if (f.previous === null) continue;
      const backup = path.join(generation, f.file);
      noLinks(backup);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.writeFileSync(backup, f.previous, { flag: 'wx' });
    }
    pruneBackups(directory, generation);
    log('Retained config drift backups: ' + generation);
  } else pruneBackups(directory);
  for (const f of drift) {
    const installed = path.join(instance, f.file);
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.writeFileSync(installed, f.bytes);
    log('Restored pack-owned file: ' + f.file);
    if (previous.includes(f.file)) log('WARNING pack-owned file restored on consecutive runs: ' + f.file + '; review game-written bytes against shipped config.');
  }
  const restored = drift.map(f => f.file);
  fs.writeFileSync(state, JSON.stringify(restored) + '\n');
  return restored;
}

module.exports = { isStrictlyPackOwned, verifyInstalledFiles, packFileDrift, previewPackFiles, restorePackFiles,
  driftBackupDirectory, DRIFT_BACKUP_DIR, DRIFT_BACKUP_LIMIT };
