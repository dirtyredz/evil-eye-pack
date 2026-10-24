'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const cfg = require('../../remote/config.cjs');
const { ownsLease, releaseScript } = require('../../remote/lease/dir_lock.cjs');

test('PowerShell release and ownsLease agree on the same owner.json cases', { skip: process.platform !== 'win32' }, () => {
  const root = fs.mkdtempSync(path.join(__dirname, 'lease-cases-'));
  const lease = { runId: 'run-a', claimId: 'claim-a' };
  const cases = [
    ['matching pair', { owner: 'run-a', claimId: 'claim-a' }, true],
    ['different run', { owner: 'run-b', claimId: 'claim-a' }, false],
    ['replacement claim for same run', { owner: 'run-a', claimId: 'claim-b' }, false],
    ['both differ', { owner: 'run-b', claimId: 'claim-b' }, false],
    ['missing run', { claimId: 'claim-a' }, false],
    ['missing claim', { owner: 'run-a' }, false],
    ['empty claim', { owner: 'run-a', claimId: '' }, false],
    ['null claim', { owner: 'run-a', claimId: null }, false],
    ['null owner', null, false],
    ['missing file', undefined, false],
    ['malformed file', '{broken', false]
  ];
  // Generate production scripts with local lock paths; never contact ANU.
  const savedLock = cfg.LOCK;
  const scripts = [];
  try {
    for (const [index, [label, owner, expected]] of cases.entries()) {
      const lock = path.join(root, String(index));
      fs.mkdirSync(lock);
      const file = path.join(lock, 'owner.json');
      if (owner !== undefined) fs.writeFileSync(file, typeof owner === 'string' ? owner : JSON.stringify(owner));
      let cur;
      try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { cur = undefined; }
      assert.equal(ownsLease(cur, lease), expected, label + ': JS');
      cfg.LOCK = lock;
      scripts.push('& { ' + releaseScript(lease) + ' }');
    }
    cfg.LOCK = savedLock;
    // One bounded PowerShell startup for the whole matrix. Malformed JSON remains
    // a reported error, and must leave its lock untouched.
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', scripts.join('\n') + '\nexit 0'], {
      encoding: 'utf8', windowsHide: true, timeout: 60000
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /ConvertFrom-Json/);
    for (const [index, [label, , expected]] of cases.entries()) {
      assert.equal(!fs.existsSync(path.join(root, String(index))), expected, label + ': PowerShell');
    }
  } finally {
    cfg.LOCK = savedLock;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
