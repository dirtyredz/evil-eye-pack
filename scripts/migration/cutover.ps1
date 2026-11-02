<#
.SYNOPSIS
Cut the Evil Eye Stable instance over from Forge 1.20.1 to NeoForge 1.21.1 (owner-run, one shot).
.DESCRIPTION
Run from the checkout that holds the merged NeoForge pack (it resolves everything from its own
location). WITHOUT -Execute this is a dry run: it evaluates every guard, sizes the archive and
verifies the pack/cache, and writes nothing outside <repo>/.tmp/owner-runs/ (the log).

With -Execute and the launcher closed it:
  1. refuses unless MultiMC and the game are closed, the checkout is the NeoForge pack, the cache
     holds the evileye_migration bridge, Stable is still Forge, and the archive drive has room;
  2. archives the whole Stable instance (saves, config, options.txt, mods, ...) except logs and
     crash reports to <ArchiveRoot>\cutover-archive-<date-time>\ with a SHA-256 manifest, verified
     against the source file by file;
  3. empties Stable's mods folder (archived) so no Forge jar can linger;
  4. switches mmc-pack.json to Minecraft 1.21.1 + NeoForge 21.1.265 and the instance Java to Temurin 21;
  5. installs the pack through the trial route (hash-verified private jars incl. the bridge) and
     points Stable's prelaunch at stable-prelaunch.ps1 so every launch repeats that install;
  6. prints the in-game steps. It never launches the game.
Never downgrade a converted world in place: use rollback.ps1, which keeps the NeoForge folder aside.

Rehearsal: -Instance <copy of the Stable instance folder> targets a copy; the launcher check is then
skipped because MultiMC is not touching the copy.
Exit codes: 0 OK (dry run complete / cutover done); 1 Node or a required tool missing; 2 a guard
refused or a step failed (a real run that fails after archiving prints the rollback command);
3 bad parameters.
.PARAMETER Execute
Perform the cutover. Omit for a dry run (also available as the explicit -DryRun).
.PARAMETER DryRun
Explicit dry run (the default without -Execute). Wins over -Execute.
.PARAMETER Instance
The instance folder (the one holding instance.cfg and .minecraft). Default: the real Evil Eye Stable.
.PARAMETER ArchiveRoot
Parent of the dated archive folder. Default: C:/Users/dirty/projects/artifacts/evil-eye-pack.
.PARAMETER Cache
Complete offline migration cache root (mods, resourcepacks, shaderpacks) containing the bridge jar.
.PARAMETER Java
Java 21 executable the instance must use.
.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File C:\path\to\checkout\scripts\migration\cutover.ps1
.EXAMPLE
powershell -NoProfile -ExecutionPolicy Bypass -File C:\path\to\checkout\scripts\migration\cutover.ps1 -Execute
#>
[CmdletBinding()]
param(
  [switch]$Execute,
  [switch]$DryRun,
  [string]$Instance = 'C:/Users/dirty/MultiMC/instances/Evil Eye Stable',
  [string]$ArchiveRoot = 'C:/Users/dirty/projects/artifacts/evil-eye-pack',
  [string]$Cache = 'C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-world-trial-final/cache',
  [string]$Java = 'C:/Tools/evil-eye-pack/temurin-21/bin/java.exe'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../owner/owner-run.ps1')
. (Join-Path $PSScriptRoot 'cutover-lib.ps1')
Initialize-OwnerRun 'cutover'

$RealStable = 'C:/Users/dirty/MultiMC/instances/Evil Eye Stable'
# Values MultiMC wrote for the working NeoForge Trial instance (same Temurin 21 install).
$JavaVersion = '21.0.13'; $JavaTimestamp = '1792603613000'
$MmcPack = @'
{
    "components": [
        {
            "cachedName": "Minecraft",
            "cachedVersion": "1.21.1",
            "important": true,
            "uid": "net.minecraft",
            "version": "1.21.1"
        },
        {
            "cachedName": "NeoForge",
            "cachedRequires": [
                {
                    "equals": "1.21.1",
                    "uid": "net.minecraft"
                }
            ],
            "cachedVersion": "21.1.265",
            "uid": "net.neoforged",
            "version": "21.1.265"
        }
    ],
    "formatVersion": 1
}
'@
$plan = -not $Execute -or $DryRun
$blockers = New-Object System.Collections.Generic.List[string]
function Block([string]$m) { $blockers.Add($m); Write-Log "  BLOCKED: $m" }
function Fmt([long]$b) { return ('{0:N2} GiB' -f ($b / 1GB)) }
function Same([string]$a, [string]$b) { return ([IO.Path]::GetFullPath($a).TrimEnd('\', '/') -ieq [IO.Path]::GetFullPath($b).TrimEnd('\', '/')) }

try {
  Write-Log ("Cutover {0}: instance {1}" -f $(if ($plan) { 'DRY RUN (nothing will be written)' } else { 'EXECUTE' }), $Instance)
  $node = Find-Tool 'node'
  if (-not $node) { Complete-OwnerRun 1 'Node 22 is required.' }
  if ($Execute -and $DryRun) { Write-Log 'Both -Execute and -DryRun given: dry run wins.' }

  # --- guards -------------------------------------------------------------------------------
  Write-Log 'Guards:'
  $mc = Join-Path $Instance '.minecraft'
  $mmcPackPath = Join-Path $Instance 'mmc-pack.json'
  $cfgPath = Join-Path $Instance 'instance.cfg'
  foreach ($p in $mc, $mmcPackPath, $cfgPath) { if (-not (Test-Path -LiteralPath $p)) { Block "Not a MultiMC instance (missing $p)" } }
  $isRealStable = Same $Instance $RealStable
  if ($isRealStable) {
    foreach ($b in (Get-LauncherBlockers)) { Block $b }
  } else {
    Write-Log '  launcher check skipped: target is a rehearsal copy, not the real Stable instance'
  }
  if ($Instance -match '(?i)evil eye (local|neoforge trial)') { Block 'Cutover never targets Evil Eye Local or the NeoForge Trial instance' }
  $pack = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'pack.toml') -Raw
  if ($pack -notmatch '(?m)^\s*neoforge\s*=\s*"21\.1\.265"' -or $pack -notmatch '(?m)^\s*minecraft\s*=\s*"1\.21\.1"') {
    Block "This checkout's pack.toml is not NeoForge 21.1.265 / Minecraft 1.21.1 (run from the merged branch)"
  }
  if (Test-Path -LiteralPath $mmcPackPath) {
    $components = (Get-Content -LiteralPath $mmcPackPath -Raw | ConvertFrom-Json).components | ForEach-Object { $_.uid }
    if ($components -contains 'net.neoforged') { Block 'Instance is already NeoForge; run rollback.ps1 first if you need Forge back' }
    elseif ($components -notcontains 'net.minecraftforge') { Block 'Instance is not Forge 1.20.1 (no net.minecraftforge component)' }
  }
  if (-not (Test-Path -LiteralPath $Java)) { Block "Java 21 not found: $Java" }
  if (-not (Test-Path -LiteralPath $Cache -PathType Container)) { Block "Cache not found: $Cache" }
  elseif (-not (Get-ChildItem -LiteralPath (Join-Path $Cache 'mods') -Filter 'evileye_migration*' -ErrorAction SilentlyContinue)) {
    Block "Cache has no evileye_migration bridge jar under $Cache\mods"
  }
  $stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
  $archiveDir = Join-Path $ArchiveRoot "cutover-archive-$stamp"
  if (Test-Path -LiteralPath $archiveDir) { Block "Archive folder already exists: $archiveDir" }
  $files = @(); $totalBytes = 0L
  if (Test-Path -LiteralPath $mc) {
    $files = @(Get-InstanceFiles $Instance)
    $totalBytes = [long]($files | Measure-Object Length -Sum).Sum
    $space = Test-ArchiveSpace $ArchiveRoot $totalBytes
    Write-Log ("  archive plan: {0} files, {1}; needs {2}, free {3} on the archive drive" -f $files.Count, (Fmt $totalBytes), (Fmt $space.Required), (Fmt $space.Free))
    if (-not $space.Ok) { Block ("Not enough free space for the archive: need {0}, have {1}" -f (Fmt $space.Required), (Fmt $space.Free)) }
  }
  if ($blockers.Count -eq 0) {
    Write-Log '  all guards passed'
  }

  # --- dry-run verification of the pack/cache (read-only) ------------------------------------
  $installerArgs = @((Join-Path $script:RepoRoot 'tools/packwiz/migration/cutover_install.cjs'), '--cache', $Cache, '--instance', $mc, '--fresh')
  if ($plan -or $blockers.Count -eq 0) {
    Write-Log 'Verifying the pack and every cached artifact (read-only):'
    $code = Invoke-Native $node ($installerArgs + '--dry-run') $script:RepoRoot
    if ($code -ne 0) { Block "Pack/cache verification failed (Node exit $code)" }
  }

  if ($plan) {
    Write-Log 'Would, in order:'
    Write-Log "  1. archive $($files.Count) files ($(Fmt $totalBytes)) to $archiveDir with a SHA-256 manifest"
    Write-Log '  2. empty .minecraft\mods and delete every file the old install tracked (all archived), so nothing stale survives'
    Write-Log "  3. rewrite mmc-pack.json -> Minecraft 1.21.1 + NeoForge 21.1.265; instance.cfg JavaPath -> $Java"
    Write-Log '  4. install the pack via the trial route and set Stable prelaunch -> stable-prelaunch.ps1'
    if ($blockers.Count) {
      Write-Log ("NOT READY: {0} blocker(s) above would stop a real run." -f $blockers.Count)
    } else { Write-Log 'READY: a real run (-Execute) would proceed.' }
    Write-Log 'Dry run complete; nothing was written outside the owner-run log.'
    Complete-OwnerRun 0
  }

  if ($blockers.Count) { Complete-OwnerRun 2 ("Refusing: {0}" -f ($blockers -join '; ')) }

  # --- execute ------------------------------------------------------------------------------
  $rollbackHint = "To restore Forge: powershell -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'rollback.ps1')`" -Archive `"$archiveDir`" -Instance `"$Instance`" -Execute"
  Write-Log "Archiving to $archiveDir ..."
  $started = Get-Date
  $n = New-InstanceArchive $Instance $archiveDir $files { param($m) Write-Log $m }
  $problems = @(Test-HashManifest (Join-Path $archiveDir 'files') (Join-Path $archiveDir 'manifest.sha256'))
  if ($problems.Count) { Complete-OwnerRun 2 ("Archive verification failed (live instance untouched): " + (($problems | Select-Object -First 5) -join '; ')) }
  Write-Log ("Archive verified: {0} files, {1}, {2:N0}s. Nothing live has changed yet." -f $n, (Fmt $totalBytes), ((Get-Date) - $started).TotalSeconds)
  try {
    $modsDir = Join-Path $mc 'mods'
    if (Test-Path -LiteralPath $modsDir) {
      Get-ChildItem -LiteralPath $modsDir -Force | Remove-Item -Recurse -Force
      Write-Log 'Emptied .minecraft\mods (the archive holds every Forge jar); the installer also clears old tracked files.'
    }
    [IO.File]::WriteAllText($mmcPackPath, ($MmcPack -replace "`r?`n", "`n") , (New-Object Text.UTF8Encoding($false)))
    $cfg = [IO.File]::ReadAllText($cfgPath)
    $cfg = Set-CfgKey $cfg 'JavaPath' ($Java -replace '\\', '/')
    $cfg = Set-CfgKey $cfg 'JavaVersion' $JavaVersion
    $cfg = Set-CfgKey $cfg 'JavaArchitecture' 'amd64'
    $cfg = Set-CfgKey $cfg 'JavaTimestamp' $JavaTimestamp
    $cfg = Set-CfgKey $cfg 'OverrideJavaLocation' 'true'
    [IO.File]::WriteAllText($cfgPath, $cfg, (New-Object Text.UTF8Encoding($false)))
    Write-Log "Switched mmc-pack.json to NeoForge 21.1.265 and the instance Java to $Java."
    $code = Invoke-Native $node $installerArgs $script:RepoRoot
    if ($code -ne 0) { throw "Pack install failed (Node exit $code)" }
  } catch {
    Write-Log "Cutover step failed after archiving: $($_.Exception.Message)"
    Write-Log $rollbackHint
    Complete-OwnerRun 2 'Cutover failed; the Forge archive is intact.'
  }
  Write-Log ''
  Write-Log "Cutover installed. Archive (rollback source): $archiveDir"
  Write-Log 'NEXT, in MultiMC:'
  Write-Log '  1. Launch "Evil Eye (Stable)" (its prelaunch reinstalls the verified pack each launch) and open your world.'
  Write-Log '  2. In game (operator): /evileye_migration convert-all dry-run'
  Write-Log '  3. Then:               /evileye_migration convert-all'
  Write-Log '  4. Repeat:             /evileye_migration status   until it reports SAFE TO REMOVE.'
  Write-Log '  Keep the bridge until then. If anything looks wrong, close the game and roll back:'
  Write-Log "  $rollbackHint"
  Complete-OwnerRun 0
} catch { Complete-OwnerRun 2 $_.Exception.Message }
