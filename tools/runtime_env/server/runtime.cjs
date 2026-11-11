'use strict';
// The server runtime a pack declares: loader, versions, required Java, installer and argument
// file, plus a stable identity (`id`) used to key loader bases, stages and world caches. Read from
// pack.toml [versions]; ambiguous or unsupported declarations are rejected. Also the runtime stamp
// (runtime.json) every base, stage and run server carries, and Java verification by the JDK's
// `release` file. Node built-ins only: it also runs on ANU inside the synced runtime_env code.
const fs = require('node:fs');
const path = require('node:path');

const STAMP = 'runtime.json';
const LOADERS = {
  forge: (mc, v) => {
    const c = `${mc}-${v}`;
    return { installerUrl: `https://maven.minecraftforge.net/net/minecraftforge/forge/${c}/forge-${c}-installer.jar`, checksum: 'sha1',
      argsFile: `libraries/net/minecraftforge/forge/${c}/win_args.txt` };
  },
  neoforge: (mc, v) => ({ installerUrl: `https://maven.neoforged.net/releases/net/neoforged/neoforge/${v}/neoforge-${v}-installer.jar`, checksum: 'sha256',
    argsFile: `libraries/net/neoforged/neoforge/${v}/win_args.txt` })
};
// Only the pairs this pack has run on; anything else needs a deliberate entry here first.
const SUPPORTED = new Set(['forge@1.20.1', 'neoforge@1.21.1']);
const OTHER_LOADERS = ['fabric', 'quilt', 'liteloader'];

const num = (v) => String(v).split('.').map(Number);
function atLeast(v, min) {
  const a = num(v), b = num(min);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d > 0; }
  return true;
}
// Mojang raised the requirement to Java 21 with 1.20.5.
const javaFor = (minecraft) => (atLeast(minecraft, '1.20.5') ? 21 : 17);

function describe({ loader, minecraft, loaderVersion }) {
  if (!LOADERS[loader]) throw new Error(`Unsupported loader: ${loader}`);
  if (!/^[\w.+-]+$/.test(minecraft || '') || !/^[\w.+-]+$/.test(loaderVersion || '')) throw new Error('Runtime needs plain minecraft and loader versions');
  if (!SUPPORTED.has(`${loader}@${minecraft}`)) throw new Error(`Unsupported runtime: ${loader} on Minecraft ${minecraft}`);
  const java = javaFor(minecraft);
  return { loader, minecraft, loaderVersion, java, id: `${loader}-${minecraft}-${loaderVersion}`, ...LOADERS[loader](minecraft, loaderVersion) };
}

// The [versions] table of pack.toml text: exactly one supported loader key plus minecraft.
function fromPackText(text) {
  const t = text.replace(/\r\n/g, '\n');
  const m = /^\[versions\]\n((?:[^[\n].*\n?)*)/m.exec(t);
  if (!m) throw new Error('pack.toml has no [versions] table');
  const values = {};
  for (const line of m[1].split('\n')) {
    const kv = /^\s*([\w-]+)\s*=\s*"([^"]*)"\s*$/.exec(line);
    if (kv) values[kv[1]] = kv[2];
  }
  const loaders = Object.keys(values).filter(k => k !== 'minecraft');
  const unknown = loaders.filter(k => !LOADERS[k]);
  if (unknown.length) throw new Error(`Unsupported loader in pack.toml: ${unknown.join(', ')}${unknown.some(k => OTHER_LOADERS.includes(k)) ? '' : ' (unknown key)'}`);
  if (loaders.length !== 1) throw new Error(`pack.toml must declare exactly one loader, found ${loaders.length ? loaders.join(' and ') : 'none'}`);
  if (!values.minecraft) throw new Error('pack.toml declares no minecraft version');
  return describe({ loader: loaders[0], minecraft: values.minecraft, loaderVersion: values[loaders[0]] });
}
const readRuntime = (packToml) => fromPackText(fs.readFileSync(packToml, 'utf8'));

// The Java executables for a runtime from the machine environment's per-major map.
function javaPaths(runtime, javas) {
  const j = javas[runtime.java];
  if (!j || !j.java) throw new Error(`No Java ${runtime.java} configured for ${runtime.id}`);
  return j;
}

// The major version of the JDK owning `javaExe` (<home>/bin/java.exe): its <home>/release file, or
// (JDK zips without one, like the MultiMC JDK 17) the `java -version` banner.
function javaMajor(javaExe, { run = (exe) => require('node:child_process').spawnSync(exe, ['-version'], { encoding: 'utf8', windowsHide: true, timeout: 30000 }) } = {}) {
  const release = path.join(path.dirname(path.dirname(javaExe)), 'release');
  if (fs.existsSync(release)) {
    const m = /^JAVA_VERSION="(\d+)(?:\.[^"]*)?"/m.exec(fs.readFileSync(release, 'utf8'));
    if (!m) throw new Error(`Cannot verify Java: no JAVA_VERSION in ${release}`);
    return Number(m[1]);
  }
  if (!fs.existsSync(javaExe)) throw new Error(`Cannot verify Java: ${javaExe} does not exist`);
  const r = run(javaExe);
  const m = /version "(\d+)(?:[.+][^"]*)?"/.exec(`${r.stderr || ''}${r.stdout || ''}`);
  if (!m) throw new Error(`Cannot verify Java: ${javaExe} -version printed no version`);
  return Number(m[1]);
}
function checkJava(javaExe, runtime) {
  const major = javaMajor(javaExe);
  if (major !== runtime.java) throw new Error(`Wrong Java for ${runtime.id}: ${javaExe} is Java ${major}, need Java ${runtime.java}`);
}

// Runtime stamps: what a base, stage or run server was built for.
const identity = (r) => ({ id: r.id, loader: r.loader, minecraft: r.minecraft, loaderVersion: r.loaderVersion, java: r.java });
function writeStamp(dir, runtime) {
  fs.writeFileSync(path.join(dir, STAMP), JSON.stringify(identity(runtime), null, 1) + '\n');
}
function readStamp(dir) {
  const f = path.join(dir, STAMP);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
// Throws unless `dir` is stamped for exactly this runtime.
function assertStamp(dir, runtime, what = 'server') {
  const s = readStamp(dir);
  if (!s) throw new Error(`${what} ${dir} has no ${STAMP}; refusing to use it for ${runtime.id}`);
  if (s.id !== runtime.id || s.java !== runtime.java) throw new Error(`${what} ${dir} was built for ${s.id} (Java ${s.java}), not ${runtime.id} (Java ${runtime.java})`);
}

module.exports = { STAMP, describe, fromPackText, readRuntime, javaFor, javaPaths, javaMajor, checkJava, identity, writeStamp, readStamp, assertStamp };
