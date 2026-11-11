#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { serverMods, compareMods } = require('../server_stage/mod-set.cjs');

// Read-only, bounded SSH. Never invokes anu-world-server.ps1 (which ships controller code).
function readDeployed({ manifest, run = spawnSync } = {}) {
  if (manifest) {
    try { return { text: fs.readFileSync(manifest, 'utf8') }; }
    catch (e) { if (e.code === 'ENOENT') return { skip: 'deployed manifest unavailable: ' + manifest }; throw e; }
  }
  const missing = 'EVIL_EYE_DEPLOY_MANIFEST_MISSING';
  // Windows' SSH shell can collapse a nested PowerShell exit code to 1; use an explicit sentinel.
  const script = "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $p='G:\\evil-eye-pack-ci\\server\\ctl\\deployed-mods.json'; if (Test-Path -LiteralPath $p) { [Console]::Write([IO.File]::ReadAllText($p)) } else { [Console]::Write('" + missing + "') }";
  const r = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', '-o', 'ConnectionAttempts=1', 'anu',
    'powershell -NoProfile -NonInteractive -EncodedCommand ' + Buffer.from(script, 'utf16le').toString('base64')],
  { encoding: 'utf8', timeout: 8000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
  if (r.error || r.status !== 0) return { skip: 'ANU unavailable (SSH failed or timed out)' };
  if (r.stdout.trim() === missing) return { skip: 'ANU deployed manifest unavailable; run Deploy to establish it' };
  return { text: r.stdout };
}

function checkParity(root, options = {}) {
  // Always validate checkout metadata, even offline. Only absence of the remote evidence skips.
  const expected = serverMods(root);
  const deployed = readDeployed(options);
  if (deployed.skip) return { code: 0, message: 'SKIP server parity: ' + deployed.skip };
  const manifest = JSON.parse(deployed.text.replace(/^\uFEFF/, ''));
  if (manifest.version !== 1) throw Error('Unsupported deployed server manifest; run Deploy');
  const { added, removed } = compareMods(expected, manifest.mods);
  if (added.length || removed.length) return { code: 1, message: `server needs Deploy: added ${added.join(', ') || '(none)'} / removed ${removed.join(', ') || '(none)'}` };
  return { code: 0, message: `OK server parity: ${expected.length} jars match last Deploy (${manifest.built || 'unknown time'})` };
}

function reportParity(root, options) {
  try {
    const result = checkParity(root, options);
    console.log(result.message);
    return result.code;
  } catch (e) { console.error('FAIL server parity: ' + e.message); return 1; }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  process.exitCode = reportParity(path.resolve(arg('--root') || path.join(__dirname, '../..')), { manifest: arg('--manifest') });
}
module.exports = { readDeployed, checkParity, reportParity };
