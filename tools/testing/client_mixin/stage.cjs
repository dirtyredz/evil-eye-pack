'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { listEntries, readEntry } = require('../../data_io/zip_reader.cjs');
const { prepareFiles } = require('../../packwiz/install/install_pack.cjs');

function archiveJson(file, name) {
  const bytes = fs.readFileSync(file);
  return JSON.parse(readEntry(bytes, listEntries(bytes).find(e => e.name === name)));
}
function coordinate(name) {
  const [group, artifact, version, classifier] = name.split(':');
  return `${group.replaceAll('.', '/')}/${artifact}/${version}/${artifact}-${version}${classifier ? '-' + classifier : ''}.jar`;
}
function safeLibraryPath(relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /[:\x00]/.test(relative) || relative.split(/[\\/]/).includes('..')) {
    throw Error('Unsafe library path: ' + relative);
  }
  return relative;
}
function stage(root, out, cache, launcher, exclude) {
  const runtime = require('../server_smoke/runtime/runtime.cjs').fromPackText(fs.readFileSync(path.join(root, 'pack.toml'), 'utf8'));
  if (runtime.loader !== 'neoforge' || runtime.loaderVersion !== '21.1.265' || runtime.minecraft !== '1.21.1') throw Error('Client audit requires NeoForge 21.1.265 / Minecraft 1.21.1');
  const libraries = path.join(out, 'libraries');
  const source = path.join(launcher, 'libraries');
  const installer = path.join(source, 'net/neoforged/neoforge/21.1.265/neoforge-21.1.265-installer.jar');
  const locked = JSON.parse(fs.readFileSync(path.join(root, 'tools/packwiz/migration/target-lock.json'))).runtime.installer;
  if (crypto.createHash('sha256').update(fs.readFileSync(installer)).digest('hex') !== locked.sha256) throw Error('Installer differs from migration lock');
  const version = archiveJson(installer, 'version.json');
  const vanilla = JSON.parse(fs.readFileSync(path.join(launcher, 'meta/net.minecraft/1.21.1.json')));
  const pins = [];
  const copy = (relative, sha1) => {
    safeLibraryPath(relative);
    const bytes = fs.readFileSync(path.join(source, relative));
    if (sha1 && crypto.createHash('sha1').update(bytes).digest('hex') !== sha1) throw Error('Library hash mismatch: ' + relative);
    const dest = path.join(libraries, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, bytes);
    pins.push({ file: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
    return dest;
  };
  const all = new Map();
  for (const lib of [...vanilla.libraries, ...version.libraries]) {
    if (lib.name.includes('natives-') && !lib.name.endsWith(':natives-windows')) continue;
    if (lib.rules?.some(r => r.os && r.os.name !== 'windows' && r.action === 'allow')) continue;
    const parts = lib.name.split(':');
    all.set(parts.slice(0, 2).join(':') + ':' + (parts[3] || ''), lib);
  }
  const cp = [];
  for (const lib of all.values()) {
    const a = lib.downloads.artifact;
    cp.push(copy(a.path || coordinate(lib.name), a.sha1));
  }
  for (const relative of [
    'net/neoforged/neoforge/21.1.265/neoforge-21.1.265-client.jar',
    'net/neoforged/neoforge/21.1.265/neoforge-21.1.265-universal.jar',
    'net/minecraft/client/1.21.1-20240808.144430/client-1.21.1-20240808.144430-extra.jar',
    'net/minecraft/client/1.21.1-20240808.144430/client-1.21.1-20240808.144430-srg.jar',
  ]) copy(relative);
  const files = prepareFiles(root, cache);
  let excluded = 0;
  for (const f of files) {
    if (exclude && f.file === 'mods/' + exclude) { excluded++; continue; }
    const dest = path.join(out, 'game', f.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.bytes);
  }
  if (exclude && excluded !== 1) throw Error('Exclusion must match one pinned jar filename');
  fs.mkdirSync(path.join(out, 'game/config'), { recursive: true });
  fs.writeFileSync(path.join(out, 'game/config/fml.toml'), 'earlyWindowControl=false\nversionCheck=false\ndisableConfigWatcher=true\n');
  fs.writeFileSync(path.join(out, 'inputs.json'), JSON.stringify({ pins, exclude, files: files.map(({file,hash}) => ({file,hash})) }, null, 2));
  return { version, libraries, cp };
}
module.exports = { stage, archiveJson, coordinate, safeLibraryPath };
