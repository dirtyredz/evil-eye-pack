'use strict';
// Private dev/trial pins. No public URL exists. Only a temporary overlay exposes verified bytes
// on loopback while the installer runs; committed metadata deliberately cannot install by itself.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { sha256 } = require('../data_io/files.cjs');
const P = require('./pack_index.cjs');
const { renderMetafile } = require('./migration/repoint.cjs');

function localTargets(root) {
  const file = path.join(root, 'tools/packwiz/migration/target-lock.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).entries.filter(e => e.target?.source === 'local').map(e => e.target);
}

function localPin(root, metafile, text) {
  const t = localTargets(root).find(t => t.metafile === metafile);
  if (!t || renderMetafile(t) !== text || !/^[a-f0-9]{64}$/.test(t.sha256) || !Number.isSafeInteger(t.size) || t.size <= 0 ||
      /[\\/]/.test(t.filename) || ['url', 'project', 'version', 'file'].some(k => k in t)) throw new Error(`Invalid private pin: ${metafile}`);
  return t;
}

function cachedLocal(t, cache) {
  const file = path.join(cache, `${t.sha256}.jar`);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== t.size || sha256(bytes) !== t.sha256) throw new Error(`Private cache differs from lock: ${t.metafile}`);
  return bytes;
}

function verifyInstalledLocal(root, instance, side = 'both') {
  for (const t of localTargets(root)) {
    if (side !== 'both' && t.side !== 'both' && t.side !== side) continue;
    const bytes = fs.readFileSync(path.join(instance, path.dirname(t.metafile), t.filename));
    if (bytes.length !== t.size || sha256(bytes) !== t.sha256) throw new Error(`Installed private jar differs from lock: ${t.metafile}`);
  }
}

async function withLocalPack(pack, cache, install) {
  const root = path.dirname(path.resolve(pack));
  const targets = localTargets(root);
  if (!targets.length) return install(pack);
  const resources = new Map();
  for (const t of targets) {
    localPin(root, t.metafile, fs.readFileSync(path.join(root, t.metafile), 'utf8'));
    resources.set(`/${t.sha256}.jar`, cachedLocal(t, cache));
  }
  const server = http.createServer((req, res) => {
    const bytes = resources.get(req.url);
    if (!bytes || req.method !== 'GET') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/java-archive', 'Content-Length': bytes.length }); res.end(bytes);
  });
  const scratch = path.join(root, '.tmp'); fs.mkdirSync(scratch, { recursive: true });
  const overlay = fs.mkdtempSync(path.join(scratch, 'private-pack-'));
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const index = P.parseIndex(fs.readFileSync(path.join(root, 'index.toml'), 'utf8'));
    for (const f of index.files) {
      if (path.isAbsolute(f.file) || f.file.split('/').includes('..')) throw new Error('Unsafe index path');
      let bytes = fs.readFileSync(path.join(root, f.file));
      if (sha256(bytes) !== f.hash) throw new Error(`Stale index: ${f.file}`);
      const t = targets.find(t => t.metafile === f.file);
      if (t) bytes = Buffer.from(renderMetafile({ ...t, source: 'direct', url: `http://127.0.0.1:${server.address().port}/${t.sha256}.jar` }));
      const dest = path.join(overlay, f.file); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, bytes);
      f.hash = sha256(bytes);
    }
    for (const t of targets) if (!index.files.some(f => f.file === t.metafile && f.metafile)) throw new Error(`Private pin missing from index: ${t.metafile}`);
    const text = P.formatIndex(index); fs.writeFileSync(path.join(overlay, 'index.toml'), text);
    fs.writeFileSync(path.join(overlay, 'pack.toml'), P.setPackIndexHash(fs.readFileSync(pack, 'utf8'), sha256(text)));
    return await install(path.join(overlay, 'pack.toml'));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(overlay, { recursive: true, force: true });
  }
}

module.exports = { localTargets, localPin, cachedLocal, verifyInstalledLocal, withLocalPack };
