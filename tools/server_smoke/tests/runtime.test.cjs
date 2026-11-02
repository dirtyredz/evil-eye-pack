'use strict';
// The runtime descriptor from pack.toml, Java selection and verification, loader-base installation
// with checksum verification, and the runtime stamps that stop cross-runtime reuse.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const rt = require('../runtime/runtime.cjs');
const { ensureLoaderBase, prepareRunDir } = require('../runtime/setup.cjs');

const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const pack = (versions) => `name = "X"\n\n[index]\nfile = "index.toml"\n\n[versions]\n${versions}\n`;

test('pack.toml selects Forge or NeoForge with their installer, argument file and Java', () => {
  const forge = rt.fromPackText(pack('forge = "47.4.10"\nminecraft = "1.20.1"'));
  assert.equal(forge.id, 'forge-1.20.1-47.4.10');
  assert.equal(forge.java, 17);
  assert.equal(forge.argsFile, 'libraries/net/minecraftforge/forge/1.20.1-47.4.10/win_args.txt');
  assert.match(forge.installerUrl, /maven\.minecraftforge\.net\/.*forge-1\.20\.1-47\.4\.10-installer\.jar$/);
  const neo = rt.fromPackText(pack('minecraft = "1.21.1"\nneoforge = "21.1.265"').replace(/\n/g, '\r\n'));
  assert.equal(neo.id, 'neoforge-1.21.1-21.1.265');
  assert.equal(neo.java, 21);
  assert.equal(neo.argsFile, 'libraries/net/neoforged/neoforge/21.1.265/win_args.txt');
  assert.match(neo.installerUrl, /maven\.neoforged\.net\/releases\/net\/neoforged\/neoforge\/21\.1\.265\/neoforge-21\.1\.265-installer\.jar$/);
  assert.equal(neo.checksum, 'sha256');
  assert.deepEqual(rt.readRuntime(path.join(__dirname, '../../../pack.toml')).loader !== undefined, true, 'the checkout pack.toml parses');
});

test('ambiguous or unsupported loader declarations are rejected', () => {
  assert.throws(() => rt.fromPackText(pack('forge = "47.4.10"\nneoforge = "21.1.265"\nminecraft = "1.21.1"')), /exactly one loader, found forge and neoforge/);
  assert.throws(() => rt.fromPackText(pack('minecraft = "1.21.1"')), /exactly one loader, found none/);
  assert.throws(() => rt.fromPackText(pack('fabric = "0.16.0"\nminecraft = "1.21.1"')), /Unsupported loader in pack\.toml: fabric/);
  assert.throws(() => rt.fromPackText(pack('neoforge = "21.1.265"')), /no minecraft version/);
  assert.throws(() => rt.fromPackText(pack('neoforge = "20.4.1"\nminecraft = "1.20.4"')), /Unsupported runtime: neoforge on Minecraft 1\.20\.4/);
  assert.throws(() => rt.fromPackText('name = "x"\n'), /no \[versions\] table/);
});

test('Java is chosen per runtime and verified from the JDK release file or the version banner', (t) => {
  const dir = tmp(t);
  const jdk = (name, release) => {
    const home = path.join(dir, name);
    fs.mkdirSync(path.join(home, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(home, 'bin/java.exe'), '');
    if (release) fs.writeFileSync(path.join(home, 'release'), release);
    return path.join(home, 'bin/java.exe');
  };
  const neo = rt.describe({ loader: 'neoforge', minecraft: '1.21.1', loaderVersion: '21.1.265' });
  const forge = rt.describe({ loader: 'forge', minecraft: '1.20.1', loaderVersion: '47.4.10' });
  const j21 = jdk('21', 'IMPLEMENTOR="Eclipse Adoptium"\nJAVA_VERSION="21.0.13"\n');
  const j17 = jdk('17', 'JAVA_VERSION="17.0.10"\n');
  assert.doesNotThrow(() => rt.checkJava(j21, neo));
  assert.throws(() => rt.checkJava(j17, neo), /Wrong Java for neoforge-1\.21\.1-21\.1\.265: .* is Java 17, need Java 21/);
  assert.throws(() => rt.checkJava(j21, forge), /is Java 21, need Java 17/);
  const banner = jdk('banner');
  assert.equal(rt.javaMajor(banner, { run: () => ({ stderr: 'java version "17.0.10" 2024-01-16 LTS\n' }) }), 17);
  assert.throws(() => rt.javaMajor(path.join(dir, 'missing/bin/java.exe')), /does not exist/);
  assert.deepEqual(rt.javaPaths(neo, { 21: { java: 'a', jcmd: 'b' } }), { java: 'a', jcmd: 'b' });
  assert.throws(() => rt.javaPaths(neo, { 17: { java: 'a' } }), /No Java 21 configured/);
});

function fakeInstall(neo) {
  return { run: async (java, args) => {
    const base = args[args.indexOf('--installServer') + 1];
    fs.mkdirSync(path.join(base, path.dirname(neo.argsFile)), { recursive: true });
    fs.writeFileSync(path.join(base, neo.argsFile), 'args');
    fs.mkdirSync(path.join(base, 'libraries/x'), { recursive: true });
    return { code: 0, out: 'installed' };
  } };
}
const http = (routes) => async (url) => (routes[url] ? { ok: true, arrayBuffer: async () => Buffer.from(routes[url]) } : { ok: false, status: 404 });

test('the loader base is installed per runtime from a checksum-verified installer and stamped', async (t) => {
  const cache = tmp(t);
  const neo = rt.describe({ loader: 'neoforge', minecraft: '1.21.1', loaderVersion: '21.1.265' });
  const installer = 'installer bytes';
  const sum = crypto.createHash('sha256').update(installer).digest('hex');
  await assert.rejects(ensureLoaderBase(cache, neo, 'java', () => {}, fakeInstall(neo), { http: http({ [`${neo.installerUrl}.sha256`]: '0'.repeat(64), [neo.installerUrl]: installer }) }), /installer checksum mismatch/);
  const base = await ensureLoaderBase(cache, neo, 'java', () => {}, fakeInstall(neo), { http: http({ [`${neo.installerUrl}.sha256`]: `${sum}  neoforge-21.1.265-installer.jar`, [neo.installerUrl]: installer }) });
  assert.equal(base, path.join(cache, 'loader-base', neo.id));
  assert.equal(rt.readStamp(base).id, neo.id);
  // Reuse needs no network; a base stamped for another runtime is refused.
  assert.equal(await ensureLoaderBase(cache, neo, 'java', () => {}, fakeInstall(neo), { http: http({}) }), base);
  const other = { ...neo, java: 17 };
  await assert.rejects(ensureLoaderBase(cache, other, 'java', () => {}, fakeInstall(neo), { http: http({}) }), /was built for neoforge-1\.21\.1-21\.1\.265 \(Java 21\)/);
  const run = path.join(cache, 'run');
  prepareRunDir(base, run, 1, '1G', '7');
  rt.assertStamp(run, neo);
});
