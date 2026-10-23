'use strict';
// Incremental copy of a directory tree to ANU: a manifest of (relative path -> size + mtime) is kept next to
// the remote copy; only new or changed files travel (one tar over scp), and files gone locally are deleted.
// The first sync sends everything. Pure manifest logic is separate from the transfer for testing.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { q } = require('./ssh.cjs');
const { LOCAL_TAR } = require('./config.cjs');

const MANIFEST = '.sync-manifest.json';

// rel path (forward slashes) -> "size:mtimeMs". skip(rel) excludes paths (the world, logs...).
function buildManifest(dir, skip = () => false) {
  const out = {};
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (r === MANIFEST || skip(r)) continue;
      const p = path.join(abs, e.name);
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) { const st = fs.statSync(p); out[r] = `${st.size}:${Math.floor(st.mtimeMs)}`; }
    }
  };
  walk(dir, '');
  return out;
}

function diffManifest(local, remote) {
  const changed = Object.keys(local).filter((k) => remote[k] !== local[k]).sort();
  const removed = Object.keys(remote || {}).filter((k) => !(k in local)).sort();
  return { changed, removed };
}

// Sends `localDir` to `remoteDir` on ANU. Returns { changed, removed, bytes, seconds }.
async function syncDir(ssh, scope, localDir, remoteDir, { incoming, skip, log, label }) {
  const t0 = Date.now();
  const local = buildManifest(localDir, skip);
  const rm = await ssh.ps(`$f = Join-Path ${q(remoteDir)} ${q(MANIFEST)}; if (Test-Path $f) { Get-Content -Raw $f } else { '{}' }`, { timeoutMs: 120000 });
  let remote = {};
  try { remote = rm.code === 0 ? JSON.parse(rm.out.trim() || '{}') : {}; } catch { remote = {}; }
  const { changed, removed } = diffManifest(local, remote);
  let bytes = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'packtest-sync-'));
  try {
    if (changed.length) {
      for (const r of changed) bytes += fs.statSync(path.join(localDir, r)).size;
      log(`${label}: sending ${changed.length} file(s), ${(bytes / 1048576).toFixed(1)} MiB`);
      const list = path.join(tmp, 'files.txt');
      fs.writeFileSync(list, changed.join('\n') + '\n');
      const tar = path.join(tmp, 'payload.tar');
      const t = await scope.run(LOCAL_TAR, ['-cf', tar, '-C', localDir, '-T', list], { timeoutMs: 1800000 });
      if (t.code !== 0) throw new Error(`tar failed: ${t.out.slice(0, 300)}`);
      const remoteTar = `${incoming}\\${label}-${process.pid}.tar`;
      await ssh.must(`New-Item -ItemType Directory -Force ${q(incoming)}, ${q(remoteDir)} | Out-Null`);
      const s = await ssh.scpTo(tar, remoteTar);
      if (s.code !== 0) throw new Error(`scp failed: ${s.out.slice(0, 300)}`);
      await ssh.must(`tar -xf ${q(remoteTar)} -C ${q(remoteDir)}; if ($LASTEXITCODE -ne 0) { throw "tar exit $LASTEXITCODE" }; Remove-Item -Force ${q(remoteTar)}`, { timeoutMs: 1800000 });
    }
    if (removed.length) {
      log(`${label}: deleting ${removed.length} file(s) no longer in the pack`);
      const listFile = path.join(tmp, 'removed.json');
      fs.writeFileSync(listFile, JSON.stringify(removed));
      const remoteList = `${incoming}\\${label}-removed-${process.pid}.json`;
      await ssh.must(`New-Item -ItemType Directory -Force ${q(incoming)} | Out-Null`);
      const s = await ssh.scpTo(listFile, remoteList);
      if (s.code !== 0) throw new Error(`scp failed: ${s.out.slice(0, 300)}`);
      await ssh.must(`$base = ${q(remoteDir)}; foreach ($r in (Get-Content -Raw ${q(remoteList)} | ConvertFrom-Json)) { $p = Join-Path $base ($r -replace '/', '\\'); if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force } }; Remove-Item -Force ${q(remoteList)}`);
    }
    const mf = path.join(tmp, MANIFEST);
    fs.writeFileSync(mf, JSON.stringify(local));
    const s = await ssh.scpTo(mf, `${remoteDir}\\${MANIFEST}`);
    if (s.code !== 0) throw new Error(`scp failed: ${s.out.slice(0, 300)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { changed: changed.length, removed: removed.length, bytes, seconds: (Date.now() - t0) / 1000 };
}

module.exports = { buildManifest, diffManifest, syncDir, MANIFEST };
