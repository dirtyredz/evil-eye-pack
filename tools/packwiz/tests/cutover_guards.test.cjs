'use strict';
// Guards and rollback integrity for scripts/migration/cutover-lib.ps1 (used by cutover.ps1 and
// rollback.ps1). Pure functions with injected process lists / free bytes, plus a tiny fixture instance.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { stablePreLaunchCommand } = require('../install/stable_target.cjs');
const { STABLE, stableTarget: cutoverInstance } = require('../install/instance_targets.cjs');

const LIB = path.resolve(__dirname, '../../../scripts/migration/cutover-lib.ps1');
const ps = process.platform === 'win32' ? 'powershell.exe' : null;

function run(body) {
  const script = `$ErrorActionPreference='Stop'; Set-StrictMode -Version 2.0; . '${LIB}'; ${body}`;
  const r = spawnSync(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

test('refuses while MultiMC or the game is running, allows unrelated Java', { skip: !ps }, () => {
  const out = run(`
    $mm = @([pscustomobject]@{Name='MultiMC.exe';ProcessId=1;CommandLine=''})
    $game = @([pscustomobject]@{Name='javaw.exe';ProcessId=2;CommandLine='java -cp x net.minecraft.client.main.Main'})
    $gradle = @([pscustomobject]@{Name='java.exe';ProcessId=3;CommandLine='java -jar gradle-wrapper.jar build'})
    @{ mm = @(Get-LauncherBlockers $mm).Count; game = @(Get-LauncherBlockers $game).Count;
       gradle = @(Get-LauncherBlockers $gradle).Count; none = @(Get-LauncherBlockers @()).Count } | ConvertTo-Json -Compress`);
  assert.deepEqual(out, { mm: 1, game: 1, gradle: 0, none: 0 });
});

test('refuses when the archive drive lacks space for the archive plus headroom', { skip: !ps }, () => {
  const out = run(`
    $tight = Test-ArchiveSpace $env:TEMP 10GB ([long]11GB)
    $roomy = Test-ArchiveSpace $env:TEMP 10GB ([long]20GB)
    @{ tightOk = $tight.Ok; roomyOk = $roomy.Ok; required = $tight.Required } | ConvertTo-Json -Compress`);
  assert.equal(out.tightOk, false);
  assert.equal(out.roomyOk, true);
  assert.ok(out.required > 10 * 2 ** 30 * 1.1);
});

test('rollback restores byte-for-byte, keeps the live folder aside and refuses a tampered archive', { skip: !ps }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cutover-guard-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const inst = path.join(root, 'instance');
  fs.mkdirSync(path.join(inst, '.minecraft/saves/World'), { recursive: true });
  fs.mkdirSync(path.join(inst, '.minecraft/logs'), { recursive: true });
  fs.writeFileSync(path.join(inst, 'instance.cfg'), 'JavaPath=jdk-17\nPreLaunchCommand=old\n');
  fs.writeFileSync(path.join(inst, 'mmc-pack.json'), '{"forge":true}');
  fs.writeFileSync(path.join(inst, '.minecraft/options.txt'), 'fov:70\n');
  fs.writeFileSync(path.join(inst, '.minecraft/saves/World/level.dat'), Buffer.from([0, 1, 2, 3, 255]));
  fs.writeFileSync(path.join(inst, '.minecraft/logs/latest.log'), 'volatile');
  const arc = path.join(root, 'archive');
  const quarantine = path.join(root, 'rollback');
  const q = s => s.replaceAll("'", "''");

  const made = run(`
    $files = @(Get-InstanceFiles '${q(inst)}')
    $n = New-InstanceArchive '${q(inst)}' '${q(arc)}' $files $null
    @{ n = $n; rels = @($files | ForEach-Object Rel) } | ConvertTo-Json -Compress`);
  assert.equal(made.n, 4);
  assert.ok(!made.rels.some(r => r.includes('logs/')), 'volatile logs are not archived');

  // The cutover mutates the instance (and a NeoForge world is converted in place).
  fs.writeFileSync(path.join(inst, 'instance.cfg'), 'JavaPath=temurin-21\n');
  fs.writeFileSync(path.join(inst, '.minecraft/saves/World/level.dat'), 'converted');
  fs.writeFileSync(path.join(inst, '.minecraft/neoforge-only.txt'), 'x');

  // Tampered archive: restore must refuse before touching the live instance.
  const archived = path.join(arc, 'files/.minecraft/options.txt');
  fs.writeFileSync(archived, 'fov:110\n');
  const bad = spawnSync(ps, ['-NoProfile', '-Command', `. '${LIB}'; Restore-InstanceArchive '${q(arc)}' '${q(inst)}' '${q(quarantine)}'`], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stdout + bad.stderr, /failed verification/);
  assert.equal(fs.readFileSync(path.join(inst, 'instance.cfg'), 'utf8'), 'JavaPath=temurin-21\n');
  assert.ok(!fs.existsSync(quarantine));
  fs.writeFileSync(archived, 'fov:70\n');

  const restored = run(`(Restore-InstanceArchive '${q(arc)}' '${q(inst)}' '${q(quarantine)}') | ConvertTo-Json -Compress`);
  assert.equal(restored, 4);
  assert.equal(fs.readFileSync(path.join(inst, 'instance.cfg'), 'utf8'), 'JavaPath=jdk-17\nPreLaunchCommand=old\n');
  assert.deepEqual([...fs.readFileSync(path.join(inst, '.minecraft/saves/World/level.dat'))], [0, 1, 2, 3, 255]);
  assert.ok(!fs.existsSync(path.join(inst, '.minecraft/neoforge-only.txt')), 'NeoForge-only file is gone from the instance');
  assert.equal(fs.readFileSync(path.join(quarantine, '.minecraft/saves/World/level.dat'), 'utf8'), 'converted');
  assert.equal(fs.readFileSync(path.join(quarantine, '.minecraft/neoforge-only.txt'), 'utf8'), 'x');
});

test('Set-CfgKey replaces or appends and keeps line endings', { skip: !ps }, () => {
  const out = run(`
    $a = Set-CfgKey "JavaPath=old\`r\`nx=1\`r\`n" 'JavaPath' 'new'
    $b = Set-CfgKey "x=1\`n" 'JavaVersion' '21'
    @{ a = $a; b = $b } | ConvertTo-Json -Compress`);
  assert.equal(out.a, 'JavaPath=new\r\nx=1\r\n');
  assert.equal(out.b, 'x=1\nJavaVersion=21\n');
});

test('cutover target is Stable (or a copy), never Local or the Trial; prelaunch repeats the install', () => {
  assert.throws(() => cutoverInstance('C:/Users/dirty/MultiMC/instances/Evil Eye Local/.minecraft'), /never targets/);
  assert.throws(() => cutoverInstance('C:/Users/dirty/MultiMC/instances/Evil Eye NeoForge Trial/.minecraft'), /never targets/);
  assert.throws(() => cutoverInstance('C:/somewhere/else'), /\.minecraft/);
  const root = 'C:/repo';
  const cmd = stablePreLaunchCommand(root, 'C:/cache', STABLE);
  assert.equal(cmd, 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:/repo/scripts/migration/stable-prelaunch.ps1" -Cache "C:/cache"');
  assert.match(stablePreLaunchCommand(root, 'C:/cache', 'D:/copy/.minecraft'), /-Instance "D:\/copy\/\.minecraft"$/);
});

test('Set-InstanceNeoForge rewrites mmc-pack.json and the Java keys; target checks delegate to Node', { skip: !ps }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'neoforge-switch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'instance.cfg'), 'JavaPath=old\nname=x\n');
  fs.writeFileSync(path.join(root, 'mmc-pack.json'), '{"forge":true}');
  const out = run(`
    Set-InstanceNeoForge '${root.replaceAll("'", "''")}' 'C:\\jdk\\bin\\java.exe'
    $stable = Test-RealStable 'C:/Users/dirty/MultiMC/instances/Evil Eye Stable'
    $copy = Test-RealStable 'C:/rehearsal/Evil Eye Stable'
    $refused = try { Assert-NotLocalOrTrial 'C:/Users/dirty/MultiMC/instances/Evil Eye Local' 'Rollback'; '' } catch { $_.Exception.Message }
    @{ stable = $stable; copy = $copy; refused = $refused } | ConvertTo-Json -Compress`);
  assert.deepEqual(out, { stable: true, copy: false, refused: 'Rollback never targets Evil Eye Local or the NeoForge Trial instance' });
  const cfg = fs.readFileSync(path.join(root, 'instance.cfg'), 'utf8');
  assert.match(cfg, /^JavaPath=C:\/jdk\/bin\/java\.exe$/m);
  assert.match(cfg, /^OverrideJavaLocation=true$/m);
  assert.match(fs.readFileSync(path.join(root, 'mmc-pack.json'), 'utf8'), /"net\.neoforged"/);
});
