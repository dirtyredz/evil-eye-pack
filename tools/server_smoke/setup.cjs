'use strict';
// Builds the throwaway server dir: cached Forge install + packwiz `-s server` install.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./procs.cjs');

const { FORGE, FORGE_URL, BOOTSTRAP, INSTALLER_JAR_SOURCES } = require('./env.cjs');

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

// Forge server installed once into <cache>/forge-base; its libraries are reused by every run.
async function ensureForgeBase(cache, java, log) {
  const base = path.join(cache, 'forge-base');
  const argsFile = path.join(base, 'libraries/net/minecraftforge/forge', FORGE, 'win_args.txt');
  if (fs.existsSync(argsFile)) return base;
  fs.mkdirSync(base, { recursive: true });
  const installer = path.join(cache, `forge-${FORGE}-installer.jar`);
  if (!fs.existsSync(installer)) { log(`downloading ${FORGE_URL}`); await download(FORGE_URL, installer); }
  log('installing Forge server (first run only)');
  const r = await run(java, ['-jar', installer, '--installServer', base], { cwd: base });
  fs.writeFileSync(path.join(cache, 'forge-install.log'), r.out);
  if (!fs.existsSync(argsFile)) throw new Error(`Forge install failed (see ${path.join(cache, 'forge-install.log')})`);
  return base;
}

function prepareRunDir(base, runDir, port, heap) {
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(path.join(base, 'libraries'), path.join(runDir, 'libraries'), { recursive: true });
  for (const f of fs.readdirSync(base)) {
    if (/^minecraft_server.*\.jar$/.test(f)) fs.copyFileSync(path.join(base, f), path.join(runDir, f));
  }
  fs.writeFileSync(path.join(runDir, 'eula.txt'), 'eula=true\n'); // owner-approved for this local test server
  fs.writeFileSync(path.join(runDir, 'server.properties'), [
    'online-mode=false', 'server-ip=127.0.0.1', `server-port=${port}`, 'level-name=smoke-world',
    'enable-rcon=false', 'enable-query=false', 'max-tick-time=-1', 'motd=server-smoke', ''
  ].join('\n'));
  fs.writeFileSync(path.join(runDir, 'user_jvm_args.txt'), `-Xmx${heap}\n-Xms1G\n`);
}

async function installPack(runDir, packToml, java, cache, log) {
  const cachedInstaller = path.join(cache, 'packwiz-installer.jar');
  if (!fs.existsSync(cachedInstaller)) {
    const src = INSTALLER_JAR_SOURCES.find((p) => fs.existsSync(p));
    if (src) fs.copyFileSync(src, cachedInstaller);
  }
  const args = ['-jar', BOOTSTRAP];
  if (fs.existsSync(cachedInstaller)) args.push('--bootstrap-main-jar', cachedInstaller);
  args.push('--bootstrap-no-update', '-g', '-s', 'server', packToml);
  log('packwiz install (-s server)');
  const r = await run(java, args, { cwd: runDir });
  fs.writeFileSync(path.join(runDir, 'packwiz-install.log'), r.out);
  if (r.code !== 0) throw new Error(`packwiz install exited ${r.code} (see ${path.join(runDir, 'packwiz-install.log')})`);
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

module.exports = { ensureForgeBase, prepareRunDir, installPack, dropMods };
