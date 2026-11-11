'use strict';
// Builds the throwaway server dir: cached loader install (Forge or NeoForge, per the pack's runtime
// descriptor from runtime.cjs) + packwiz `-s server` install.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { writeStamp, readStamp, assertStamp } = require('../runtime_env/server/runtime.cjs');

const { BOOTSTRAP, INSTALLER_JAR_SOURCES, INSTALLER_URL } = require('../runtime_env/env.cjs');

async function fetchBytes(url, http) {
  const res = await http(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// The installer jar, verified against the loader Maven's published checksum (sha1 for Forge, sha256
// for NeoForge). The verified checksum is kept in a sidecar so later installs verify it offline.
async function verifiedInstaller(cache, runtime, log, http = fetch) {
  const url = INSTALLER_URL || runtime.installerUrl;
  const installer = path.join(cache, path.basename(runtime.installerUrl));
  const sidecar = `${installer}.${runtime.checksum}`;
  const digest = (b) => crypto.createHash(runtime.checksum).update(b).digest('hex');
  let want = fs.existsSync(sidecar) ? fs.readFileSync(sidecar, 'utf8').trim() : null;
  if (!want) want = (await fetchBytes(`${runtime.installerUrl}.${runtime.checksum}`, http)).toString('utf8').trim().split(/\s+/)[0];
  if (fs.existsSync(installer) && digest(fs.readFileSync(installer)) !== want) fs.rmSync(installer);
  if (!fs.existsSync(installer)) {
    log(`downloading ${url}`);
    const bytes = await fetchBytes(url, http);
    if (digest(bytes) !== want) throw new Error(`${runtime.loader} installer checksum mismatch for ${url}`);
    fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(installer, bytes);
  }
  fs.writeFileSync(sidecar, `${want}\n`);
  return installer;
}

// The loader server installed once into <cache>/loader-base/<runtime id>; its libraries are reused by
// every run. A base stamped for another runtime is never reused. scope owns the installer process.
// deps.http: injected fetch (tests).
async function ensureLoaderBase(cache, runtime, java, log, scope, deps = {}) {
  const base = path.join(cache, 'loader-base', runtime.id);
  const argsFile = path.join(base, runtime.argsFile);
  if (fs.existsSync(argsFile) && readStamp(base)) { assertStamp(base, runtime, 'loader base'); return base; }
  fs.mkdirSync(base, { recursive: true });
  const installer = await verifiedInstaller(cache, runtime, log, deps.http);
  log(`installing the ${runtime.id} server (first run for this runtime only)`);
  const r = await scope.run(java, ['-jar', installer, '--installServer', base], { cwd: base });
  const installLog = path.join(cache, `${runtime.id}-install.log`);
  fs.writeFileSync(installLog, r.out);
  if (!fs.existsSync(argsFile)) throw new Error(`${runtime.loader} install failed (see ${installLog})`);
  writeStamp(base, runtime);
  return base;
}

// The run dir carries the base's runtime stamp (runtime.json) so the boot and any reuse verify it.
function prepareRunDir(base, runDir, port, heap, seed) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(path.join(base, 'libraries'), path.join(runDir, 'libraries'), { recursive: true });
  for (const f of fs.readdirSync(base)) {
    if (/^minecraft_server.*\.jar$/.test(f)) fs.copyFileSync(path.join(base, f), path.join(runDir, f));
  }
  fs.writeFileSync(path.join(runDir, 'eula.txt'), 'eula=true\n'); // owner-approved for this local test server
  fs.writeFileSync(path.join(runDir, 'server.properties'), [
    `level-seed=${seed}`, 'online-mode=false', 'server-ip=127.0.0.1', `server-port=${port}`, 'level-name=smoke-world',
    'enable-rcon=false', 'enable-query=false', 'max-tick-time=-1', 'motd=server-smoke', ''
  ].join('\n'));
  fs.writeFileSync(path.join(runDir, 'user_jvm_args.txt'), `-Xmx${heap}\n-Xms1G\n`);
  const stamp = readStamp(base);
  if (stamp) fs.writeFileSync(path.join(runDir, 'runtime.json'), JSON.stringify(stamp, null, 1) + '\n');
}

// The level-seed a run was started with, or null when the run has no server.properties or no seed line.
function readRunSeed(runDir) {
  const props = path.join(runDir, 'server.properties');
  const m = fs.existsSync(props) && /^level-seed=(.*)$/m.exec(fs.readFileSync(props, 'utf8'));
  return m ? m[1] : null;
}

async function installPack(runDir, packToml, java, cache, log, scope) {
  const { withLocalPack, verifyInstalledLocal } = require('../packwiz/install/local_source.cjs');
  const cachedInstaller = path.join(cache, 'packwiz-installer.jar');
  if (!fs.existsSync(cachedInstaller)) {
    const src = INSTALLER_JAR_SOURCES.find((p) => fs.existsSync(p));
    if (src) fs.copyFileSync(src, cachedInstaller);
  }
  const args = ['-jar', BOOTSTRAP];
  if (fs.existsSync(cachedInstaller)) args.push('--bootstrap-main-jar', cachedInstaller);
  args.push('--bootstrap-no-update', '-g', '-s', 'server');
  log('packwiz install (-s server)');
  const r = await withLocalPack(packToml, require('../runtime_env/env.cjs').MIGRATION_MODS,
    overlay => scope.run(java, [...args, overlay], { cwd: runDir }));
  fs.writeFileSync(path.join(runDir, 'packwiz-install.log'), r.out);
  if (r.code !== 0) throw new Error(`packwiz install exited ${r.code} (see ${path.join(runDir, 'packwiz-install.log')})`);
  verifyInstalledLocal(path.dirname(path.resolve(packToml)), runDir, 'server');
}

// Deletes installed jars whose name contains a term, from the throwaway server only (to find the next offender).
function dropMods(runDir, terms, log) {
  const modsDir = path.join(runDir, 'mods');
  for (const term of terms) {
    for (const f of fs.readdirSync(modsDir)) {
      if (f.toLowerCase().includes(term.toLowerCase())) { fs.rmSync(path.join(modsDir, f)); log(`dropped ${f}`); }
    }
  }
}

module.exports = { ensureLoaderBase, verifiedInstaller, prepareRunDir, readRunSeed, installPack, dropMods };
