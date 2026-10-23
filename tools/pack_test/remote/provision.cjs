#!/usr/bin/env node
'use strict';
// One-time, idempotent ANU setup for the pack test: portable Node 22 and Temurin JDK 17 under
// C:\Tools\evil-eye-pack (each zip SHA-256-verified against its publisher before extraction), the
// G:\evil-eye-pack-ci folders, and the README there. Never edits PATH, JAVA_HOME or Defender.
// Usage: node tools/pack_test/remote/provision.cjs        (run.cjs also calls ensureProvisioned)
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('./config.cjs');
const { q } = require('./ssh.cjs');

const nodeExe = `${cfg.NODE.dir}\\node.exe`;
const javaExe = `${cfg.JAVA.dir}\\bin\\java.exe`;
const jcmdExe = `${cfg.JAVA.dir}\\bin\\jcmd.exe`;

// Fast check used before every run.
async function isProvisioned(ssh) {
  const r = await ssh.ps(`if ((Test-Path ${q(nodeExe)}) -and (Test-Path ${q(javaExe)}) -and (Test-Path ${q(`${cfg.ROOT}\\README.md`)})) { 'yes' } else { 'no' }`, { timeoutMs: 60000 });
  return r.code === 0 && /yes/.test(r.out);
}

const INSTALL = `
$tools = ${q(cfg.TOOLS)}; $root = ${q(cfg.ROOT)}; $dl = Join-Path $root 'downloads'
New-Item -ItemType Directory -Force $tools, $dl, (Join-Path $root 'runs'), (Join-Path $root 'stage'), (Join-Path $root 'cache\\worlds'), (Join-Path $root 'incoming') | Out-Null
function Verify($file, $expected) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLower()
  if ($actual -ne $expected.ToLower()) { Remove-Item -Force $file; throw "checksum mismatch for $file : $actual != $expected" }
  return $actual
}
if (-not (Test-Path ${q(nodeExe)})) {
  $zip = Join-Path $dl 'node.zip'
  Invoke-WebRequest -UseBasicParsing -Uri ${q(cfg.NODE.url)} -OutFile $zip
  $sums = (Invoke-WebRequest -UseBasicParsing -Uri ${q(cfg.NODE.sums)}).Content
  $line = ($sums -split "\`n") | Where-Object { $_ -match ' ${path.basename(cfg.NODE.url)}$' } | Select-Object -First 1
  $sha = Verify $zip (($line -split '\\s+')[0])
  tar -xf $zip -C $tools; if ($LASTEXITCODE -ne 0) { throw "node unzip failed" }
  Set-Content -Encoding ascii -LiteralPath (Join-Path ${q(cfg.NODE.dir)} 'SHA256.txt') -Value "${path.basename(cfg.NODE.url)} $sha"
}
if (-not (Test-Path ${q(javaExe)})) {
  $pkg = (Invoke-RestMethod -Uri ${q(cfg.JAVA.api)})[0]
  $zip = Join-Path $dl $pkg.binary.package.name
  Invoke-WebRequest -UseBasicParsing -Uri $pkg.binary.package.link -OutFile $zip
  $sha = Verify $zip $pkg.binary.package.checksum
  $tmp = Join-Path $dl 'jdk-extract'; if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }; New-Item -ItemType Directory $tmp | Out-Null
  tar -xf $zip -C $tmp; if ($LASTEXITCODE -ne 0) { throw "jdk unzip failed" }
  $inner = Get-ChildItem $tmp -Directory | Select-Object -First 1
  Move-Item $inner.FullName ${q(cfg.JAVA.dir)}
  Remove-Item -Recurse -Force $tmp
  Set-Content -Encoding ascii -LiteralPath (Join-Path ${q(cfg.JAVA.dir)} 'SHA256.txt') -Value "$($pkg.binary.package.name) $sha (Adoptium release $($pkg.release_name))"
}
Write-Output ("NODE " + (& ${q(nodeExe)} --version) + " | " + (Get-Content -Raw (Join-Path ${q(cfg.NODE.dir)} 'SHA256.txt')).Trim())
Write-Output ("JAVA " + (Get-Content -Raw (Join-Path ${q(cfg.JAVA.dir)} 'SHA256.txt')).Trim())
`;

async function provision(ssh, scope, log) {
  log('provisioning ANU (portable Node and JDK, folders, README)');
  const out = await ssh.must(INSTALL, { timeoutMs: 1800000 });
  const lines = out.split(/\r?\n/).filter((l) => /^(NODE|JAVA) /.test(l));
  const installed = [
    `- Node: \`${cfg.NODE.dir}\` - ${(lines.find((l) => l.startsWith('NODE')) || '').slice(5)} (SHA-256 verified against nodejs.org SHASUMS256.txt)`,
    `- Temurin JDK 17: \`${cfg.JAVA.dir}\` - ${(lines.find((l) => l.startsWith('JAVA')) || '').slice(5)} (SHA-256 verified against the Adoptium API)`,
    `- Updated ${new Date().toISOString().slice(0, 10)} from Valhalla.`
  ].join('\n');
  const readme = fs.readFileSync(path.join(__dirname, 'anu-readme.md'), 'utf8').replace('{{INSTALLED}}', installed);
  const tmp = path.join(require('node:os').tmpdir(), `anu-readme-${process.pid}.md`);
  fs.writeFileSync(tmp, readme);
  try {
    const r = await ssh.scpTo(tmp, `${cfg.ROOT}\\README.md`);
    if (r.code !== 0) throw new Error(`README upload failed: ${r.out}`);
  } finally { fs.rmSync(tmp, { force: true }); }
  log(lines.join('\n'));
  return lines;
}

async function ensureProvisioned(ssh, scope, log) {
  if (await isProvisioned(ssh)) return false;
  await provision(ssh, scope, log);
  return true;
}

module.exports = { ensureProvisioned, provision, isProvisioned, nodeExe, javaExe, jcmdExe };

if (require.main === module) {
  const procs = require('../../server_smoke/procs.cjs');
  const { connect } = require('./ssh.cjs');
  (async () => {
    const scope = procs.scope();
    const ssh = await connect(scope);
    if (!ssh) throw new Error('ANU is not reachable over SSH (aliases anu, anu-byname)');
    await provision(ssh, scope, (m) => console.log(`[provision] ${m}`));
  })().catch((e) => { console.error(e.message); process.exitCode = 1; });
}
