'use strict';
// Brings a finished ANU run's evidence home: tar it on ANU, download it, unpack it beside the local
// run folder and merge it into the locally staged evidence.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cfg = require('./config.cjs');
const { q } = require('./ssh.cjs');

async function pullEvidence(ssh, scope, remoteRun, runDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'packtest-pull-'));
  try {
    const remoteTar = `${remoteRun}\\evidence.tar`;
    await ssh.must(`Set-Location ${q(remoteRun)}; if (-not (Test-Path evidence)) { New-Item -ItemType Directory evidence | Out-Null }; tar -cf evidence.tar evidence agent.log status.json job.json; if ($LASTEXITCODE -ne 0) { throw "tar exit $LASTEXITCODE" }`, { timeoutMs: 600000 });
    const local = path.join(tmp, 'evidence.tar');
    const r = await ssh.scpFrom(remoteTar, local);
    if (r.code !== 0) throw new Error(`evidence download failed: ${r.out.slice(0, 300)}`);
    const remoteFiles = path.join(runDir, 'remote');
    fs.mkdirSync(remoteFiles, { recursive: true });
    const x = await scope.run(cfg.LOCAL_TAR, ['-xf', local, '-C', remoteFiles], { timeoutMs: 600000 });
    if (x.code !== 0) throw new Error(`evidence unpack failed: ${x.out.slice(0, 300)}`);
    // Probe payloads, logs and crash reports join the locally staged evidence (resources, pack config).
    fs.cpSync(path.join(remoteFiles, 'evidence'), path.join(runDir, 'evidence'), { recursive: true });
    fs.rmSync(path.join(remoteFiles, 'evidence'), { recursive: true, force: true });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

module.exports = { pullEvidence };
