'use strict';
// Platform identity and verified bytes for one selector. Platform API answers are cached as raw
// JSON in the job folder; downloads go to the migration cache and are checked against what the
// publisher states (Modrinth sha1+sha512; CurseForge file length plus the CDN's MD5 ETag; GitHub
// release asset sha256 digest; NeoForge Maven .sha256). Never guesses a download URL: CurseForge
// bytes come through the site's own download redirect, Modrinth and GitHub from their APIs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const UA = 'EvilEyePack-NeoForge-migration/1.0 (owner-authorised lock build; cached)';
const hash = (algo, bytes) => crypto.createHash(algo).update(bytes).digest('hex');

function client({ rawDir, http = fetch, log = () => {} }) {
  fs.mkdirSync(rawDir, { recursive: true });
  async function json(name, url) {
    const file = path.join(rawDir, name.replace(/[^\w.-]+/g, '_'));
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    const res = await http(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    const text = await res.text();
    fs.writeFileSync(file, text);
    return JSON.parse(text);
  }
  async function bytes(url) {
    log(`download ${url}`);
    const res = await http(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return { bytes: Buffer.from(await res.arrayBuffer()), finalUrl: res.url || url, etag: res.headers.get('etag') };
  }
  return { json, bytes };
}

// Reuse a cached file only when it matches every publisher check; otherwise download and verify.
async function cachedDownload(api, dest, url, verify) {
  // The sidecar keeps the download's ETag so a reused file is checked (and recorded) identically.
  const side = `${dest}.download.json`;
  if (fs.existsSync(dest) && fs.existsSync(side)) {
    const b = fs.readFileSync(dest);
    const meta = JSON.parse(fs.readFileSync(side, 'utf8'));
    try { verify(b, meta.etag); return { bytes: b, finalUrl: meta.finalUrl, cached: true }; } catch { fs.rmSync(dest); }
  }
  const r = await api.bytes(url);
  verify(r.bytes, r.etag);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(`${dest}.part`, r.bytes);
  fs.renameSync(`${dest}.part`, dest);
  fs.writeFileSync(side, JSON.stringify({ url, finalUrl: r.finalUrl, etag: r.etag }) + '\n');
  return { ...r, cached: false };
}

function expect(cond, msg) { if (!cond) throw new Error(msg); }

// Resolve and verify one selector. tags: { minecraft, loader } that the platform must declare (mods).
// Returns the lock target fields (minus name/side/metafile) and the cache path.
async function resolveSelector(sel, { api, cacheDir, folder, tags }) {
  if (sel.source === 'modrinth') {
    const v = await api.json(`mr-version-${sel.version}.json`, `https://api.modrinth.com/v2/version/${sel.version}`);
    expect(v.project_id === sel.project, `modrinth version ${sel.version} belongs to ${v.project_id}, not ${sel.project}`);
    if (tags?.minecraft) expect((v.game_versions || []).includes(tags.minecraft), `modrinth ${sel.version} is not tagged ${tags.minecraft}`);
    if (tags?.loader) expect((v.loaders || []).includes(tags.loader), `modrinth ${sel.version} is not tagged ${tags.loader}`);
    const file = sel.filename ? v.files.find(f => f.filename === sel.filename) : (v.files.find(f => f.primary) || v.files[0]);
    expect(file, `modrinth ${sel.version} has no file ${sel.filename || ''}`);
    const dest = path.join(cacheDir, folder, file.filename);
    const got = await cachedDownload(api, dest, file.url, (b) => {
      expect(hash('sha512', b) === file.hashes.sha512 && hash('sha1', b) === file.hashes.sha1, `modrinth hash mismatch for ${file.filename}`);
    });
    return target(got.bytes, { source: 'modrinth', project: sel.project, version: sel.version, versionNumber: v.version_number, channel: v.version_type,
      filename: file.filename, url: file.url, publisher: { sha1: file.hashes.sha1, sha512: file.hashes.sha512, size: file.size } }, dest);
  }
  if (sel.source === 'curseforge') {
    const info = (await api.json(`cf-file-${sel.project}-${sel.file}.json`, `https://www.curseforge.com/api/v1/mods/${sel.project}/files/${sel.file}`)).data;
    expect(String(info.projectId) === String(sel.project), `curseforge file ${sel.file} belongs to ${info.projectId}`);
    const gv = (info.gameVersions || []).map(x => x.toLowerCase());
    if (tags?.minecraft) expect(gv.includes(tags.minecraft), `curseforge ${sel.file} is not tagged ${tags.minecraft}`);
    if (tags?.loader) expect(gv.includes(tags.loader), `curseforge ${sel.file} is not tagged ${tags.loader}`);
    const dest = path.join(cacheDir, folder, info.fileName);
    let md5 = null;
    const got = await cachedDownload(api, dest, `https://www.curseforge.com/api/v1/mods/${sel.project}/files/${sel.file}/download`, (b, etag) => {
      expect(b.length === info.fileLength, `curseforge size mismatch for ${info.fileName}: ${b.length} != ${info.fileLength}`);
      const tag = (etag || '').replace(/"/g, '');
      if (/^[0-9a-f]{32}$/.test(tag)) { expect(hash('md5', b) === tag, `curseforge CDN MD5 mismatch for ${info.fileName}`); md5 = tag; }
    });
    return target(got.bytes, { source: 'curseforge', project: String(sel.project), file: String(sel.file), versionNumber: info.displayName,
      channel: ({ 1: 'release', 2: 'beta', 3: 'alpha' })[info.releaseType] || String(info.releaseType), filename: info.fileName,
      publisher: { size: info.fileLength, ...(md5 ? { md5 } : {}) } }, dest);
  }
  if (sel.source === 'direct') {
    const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/]+)$/.exec(sel.url);
    expect(m, `direct selector must be a GitHub release asset URL: ${sel.url}`);
    const rel = await api.json(`gh-${m[1]}-${m[2]}-${m[3]}.json`, `https://api.github.com/repos/${m[1]}/${m[2]}/releases/tags/${m[3]}`);
    const asset = (rel.assets || []).find(a => a.name === decodeURIComponent(m[4]));
    expect(asset, `GitHub release ${m[3]} has no asset ${m[4]}`);
    const digest = /^sha256:([0-9a-f]{64})$/.exec(asset.digest || '');
    expect(digest || sel.sha256, `GitHub asset ${asset.name} has no published sha256 digest and the selector pins none`);
    const want = digest ? digest[1] : sel.sha256;
    const dest = path.join(cacheDir, folder, asset.name);
    const got = await cachedDownload(api, dest, sel.url, (b) => {
      expect(b.length === asset.size && hash('sha256', b) === want, `GitHub asset mismatch for ${asset.name}`);
    });
    return target(got.bytes, { source: 'direct', versionNumber: m[3], channel: rel.prerelease ? 'beta' : 'release', filename: asset.name, url: sel.url,
      publisher: { sha256: want, size: asset.size } }, dest);
  }
  throw new Error(`unknown selector source ${sel.source}`);
}

function target(bytes, fields, cachePath) {
  return { fields: { ...fields, size: bytes.length, sha1: hash('sha1', bytes), sha256: hash('sha256', bytes), sha512: hash('sha512', bytes) }, cachePath, bytes };
}

// The loader installer, verified against Maven's published .sha256.
async function resolveInstaller(version, { api, cacheDir }) {
  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
  const res = await api.bytes(`${url}.sha256`);
  const want = res.bytes.toString('utf8').trim().split(/\s+/)[0];
  const dest = path.join(cacheDir, 'installers', path.basename(url));
  const got = await cachedDownload(api, dest, url, (b) => expect(hash('sha256', b) === want, `NeoForge installer sha256 mismatch`));
  return { url, sha256: hash('sha256', got.bytes), size: got.bytes.length, cachePath: dest };
}

module.exports = { client, resolveSelector, resolveInstaller };
