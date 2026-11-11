'use strict';
// The loader installer jar: downloaded once into the cache and verified against the loader Maven's
// published checksum (sha1 for Forge, sha256 for NeoForge).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { INSTALLER_URL } = require('../runtime_env/env.cjs');

async function fetchBytes(url, http) {
  const res = await http(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// The verified checksum is kept in a sidecar so later installs verify it offline. http: injected fetch (tests).
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

module.exports = { verifiedInstaller };
