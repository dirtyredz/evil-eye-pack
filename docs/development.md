# Development workflow

How the pack source, experiment worktrees, job artifacts and MultiMC instances fit together,
and how to test a change in the game before it is pushed.

## Where things live

| Path (under `C:/Users/dirty/`) | Responsibility |
|---|---|
| `projects/evil-eye-pack/` | Main checkout (`main`). Pack files keep their layout. |
| `projects/worktrees/evil-eye-pack/<name>/` | Linked worktrees for isolated experiments and implementation branches. |
| `projects/artifacts/evil-eye-pack/jobs/<date-task>/` | Dispatch prompts, plans, reports and their `.events.jsonl` / `.job.json` / `.stderr.log` sidecars. |
| `MultiMC/instances/Evil Eye Stable/` | Display name **Evil Eye (Stable)**. The owner's real worlds. Installs published `main`. |
| `MultiMC/instances/Evil Eye Local/` | Disposable copy of Stable (no saves). Installs the main checkout from its `pack.toml` file path. |
| `MultiMC/packwiz/packwiz-installer-bootstrap.jar` | Shared installer bootstrap used by every instance. |
| `MultiMC/backups/evil-eye/<instance>/<timestamp>/` | Instance backups (`instance/`, `launcher/`, `SHA256SUMS.txt`). Older `MultiMC/backups/Evil Eye 2026-10-11/` is kept as is. |

Use a **worktree plus its own instance** for every experiment. The worktree isolates source;
the instance isolates installed jars, installer state (`.minecraft/packwiz.json`), configs and
worlds. Switch branches in a checkout only for quick reading, never while its feed is served.

## Instance and feed mapping

Every instance runs the same pre-launch command; only the pack location differs:
`"$INST_JAVA" -jar "C:/Users/dirty/MultiMC/packwiz/packwiz-installer-bootstrap.jar" <PACK>`

Local instances point `<PACK>` at a `pack.toml` file path, not a URL. The installer reads that checkout
directly on every launch (verified headless 2026-10-11: full install, exit 0), so there is no server to start.

| Instance | `<PACK>` | Installs from |
|---|---|---|
| Evil Eye (Stable) | `https://raw.githubusercontent.com/dirtyredz/evil-eye-pack/main/pack.toml` | GitHub (after a push) |
| Evil Eye Local | `C:/Users/dirty/projects/evil-eye-pack/pack.toml` | the main checkout on disk |

Each test instance's path belongs to one checkout; never point an instance at another checkout's `pack.toml`.
`tools/packwiz/serve.cjs` is no longer needed for MultiMC (kept as a tool for serving a checkout over HTTP).

## Testing an uncommitted change

1. Edit the pack file. Save it as UTF-8 with LF line endings.
2. `node tools/packwiz/rehash.cjs` (rebuilds `index.toml`, then the index hash in `pack.toml`).
3. `node tools/packwiz/verify_hashes.cjs` must print `OK 0 mismatches`.
4. Click Launch on the matching **test** instance in MultiMC. Do not edit source files while it installs.
   If the installer fails (bad path, hash mismatch), abort; never click past it to play on stale files.

The installer reads exact disk bytes and does not rehash. Steps 2 and 3 come before every launch.

## Checks (fast gate)

```
node --test tools/packwiz/tests/verify_hashes.test.cjs
node --test tools/malware_guard/tests/*.test.cjs tools/dedup/tests/*.cjs tools/packwiz/tests/*.cjs tools/emi_curation/tests/*.cjs tools/server_smoke/tests/*.cjs tools/pack_test/tests/*/*.cjs tools/showcase/tests/*.cjs
# DEDUP_MODS may override the cached Local mods path (semicolon-separated cache folders).
# After changing duplicate policy or a pinned source jar, review and regenerate:
# node tools/dedup/generate.cjs "C:/Users/dirty/MultiMC/instances/Evil Eye Local/.minecraft/mods"
node tools/packwiz/rehash.cjs --dry-run      # a second run after rehash must show +0 -0 ~0
node tools/packwiz/verify_hashes.cjs
git diff --check
git worktree list --porcelain
```

Tooling needs Node 22. There is no packwiz CLI and no build step.

For showcase changes, the focused fast gate is:

```powershell
node --test tools/showcase/tests/*.cjs tools/server_smoke/tests/*.cjs tools/pack_test/tests/session/*.cjs tools/packwiz/tests/*.cjs
node tools/packwiz/rehash.cjs
node tools/packwiz/rehash.cjs --dry-run
node tools/packwiz/verify_hashes.cjs
git diff --check
dk check
```

Also run `node tools/showcase/check.cjs <section>` for the actual in-world
behaviour. It reuses the server supervisor, requires cached inputs and never
downloads. [Showcases](showcases.md) covers commands, layout, baseline comparison
and adding a section with its check. This targeted live fixture check is the
showcase acceptance run; do not also run the unrelated full pack-test tier.

## Mod map

From any working directory, invoke the checkout's `scripts/mod-map/build.ps1`
(PowerShell `-File` also works). `-DryRun` verifies the pinned jar inventory and
describes the action without a boot or artifact writes; logs are still written.
Node 22 is required; no packages, installers or downloads are used.

```powershell
scripts/mod-map/build.ps1 -DryRun
scripts/mod-map/build.ps1
# If the exact mod-set world cache is absent, explicitly select an older cached
# world to COPY into the disposable server; the report records this limitation:
scripts/mod-map/build.ps1 -World C:/Users/dirty/projects/artifacts/evil-eye-pack/pack-test/cache/worlds/2497b2d8a8270a64/smoke-world
# Re-render the same boot after a presentation change, without another JVM:
scripts/mod-map/build.ps1 -Evidence C:/Users/dirty/projects/artifacts/evil-eye-pack/mod-map/runs/<timestamp>
```

Outputs are `artifacts/evil-eye-pack/mod-map/mod-map.html` and
`mod-map-<timestamp>.html`, both complete offline pages. Raw trace, registry
snapshot, boot/provenance records and the stopped disposable server remain in
`mod-map/runs/<timestamp>/`. `-Out` selects another directory under the artifacts
root. Owner logs are under `.tmp/owner-runs/`; Node logs under `.tmp/logs/`.
The script ends with `OK/FAILED (exit N) log: <path>`.

Jar discovery searches Evil Eye Local and the pack-test staged server, accepting
only bytes matching this checkout's `.pw.toml` hashes. `-Mods` and `-Cache`
override those read-only inputs. Missing pins fail rather than silently dropping
mods. The full client inventory is mapped; only server-compatible jars are booted.
The local offline mode reuses showcase preparation, pack-test world copying and
registry collection, and server-smoke supervision. It waits for an idle Minecraft
JVM slot (up to 45 minutes) and takes a mod-map lock. This explicit local capture
avoids changing ANU's shared stage/logging or triggering remote provisioning.
It stops its JVM after `Done` and the registry snapshot. It does not run the full
pack-test acceptance suite. `-Evidence` rejects mismatched index/jar pins.

Family roots are content mods with mandatory content add-ons. Add-ons follow
mandatory dependencies transitively and nest under their immediate add-on or base;
a bridge appears in every family it belongs to. Every mandatory library nests beneath
its user in each applicable family; shared badges name the other families. Libraries
with no mandatory users appear only in the collapsed unused-libraries row. Optional
dependencies are displayed but never create membership. Suites whose metadata does
not express the player-facing family (currently MineColonies and Macaw's) use
reasoned data overrides rather than code special cases. Kinds use side metadata,
descriptions and live namespace registry counts, with corrections in
`tools/mod_map/overrides.json`. Zero registrations plus mandatory users is a library
heuristic, not a guarantee. Family totals include shared add-ons in each applicable
family; the page-wide attributed total de-duplicates every mod ID.

Each mod row stays on one line: the first `mods.toml` description sentence is
trimmed to 120 characters and ellipsized as muted text, with the displayed text
also available as a tooltip. A badge shows direct mandatory users (named on
hover), a pack-wide-fix reason, or that nothing depends on the mod; another badge
names its non-Forge/Minecraft requirements. Custom `modLoader` values are
mandatory edges. Shared jar-in-jar libraries stay under every owning parent and
are labelled as bundled, not independently removable. Confirmed undeclared code
edges and pack-wide-fix reasons live in `overrides.json`, not source special cases.

Every family and standalone mod is assigned to a top-level purpose category by
`tools/mod_map/categories.json`; unknown future IDs remain visible under Other /
Uncategorised. Category totals de-duplicate shared members and libraries within
that category. The compact page starts with both category and family rows collapsed,
and keeps mandatory libraries nested beneath their users.

Timing is the sum of paired Forge TRACE intervals for construction, subscriber
registration and synchronous event dispatch before `Done`. It is partial elapsed
work, not CPU time or estimated savings; concurrent intervals overlap. Unknown
and client-only costs remain unmeasured. See [timing caveats](GOTCHAS.md#mod-map-timing).

Focused fast gate (no build or lint command exists for this Node-only tooling):

```powershell
node --test tools/mod_map/tests/*.cjs tools/script-run/*.test.mjs tools/server_smoke/tests/*.cjs tools/pack_test/tests/session/*.cjs tools/packwiz/tests/*.cjs
node tools/packwiz/rehash.cjs --dry-run
node tools/packwiz/verify_hashes.cjs
git diff --check
dk check
```

## Malware guard

All commands use Node 22 and return JSON. Exit 0 means no unexplained findings,
1 means new findings, 2 means invalid/incomplete input (including online `not
checked`). The content commands only read their target. `--out <file>` saves the
full report, including entry hashes, and prints counts. Policies live under
`tools/malware_guard/data/`, outside the installed pack.

```powershell
node tools/malware_guard/cli.cjs scan "C:/Users/dirty/MultiMC/instances/Evil Eye Stable/.minecraft" --out tools/malware_guard/.local/scan.json
node tools/malware_guard/cli.cjs drift "C:/Users/dirty/MultiMC/instances/Evil Eye Stable/.minecraft"
node tools/malware_guard/cli.cjs gate
node --test tools/malware_guard/tests/*.test.cjs tools/pack_test/tests/*/*.cjs tools/dedup/tests/*.cjs
```

`scan` also accepts a mods directory, jar, ZIP or folder resource pack. A folder
containing `pack.mcmeta` is a resource pack; `--resource-pack` forces that context.
Instance scans cover `mods/`, `resourcepacks/` and `shaderpacks/`, not saves or the
launcher's libraries. Executables and Java code hidden in pack textures are
reported. The loader heuristics use same-class API co-occurrence, not proven data
flow. To tune them or scan limits, copy `data/heuristics.json` and use `--config`.
Signature and loader/network/Base64 patterns live in `data/signatures.json`; invalid patterns fail at load time.
Do not suppress a finding just because its library name looks familiar.

Review a match's exact bytes, then use its `sha256` and `finding` fields:

```powershell
node tools/malware_guard/cli.cjs approve --sha256 <reported-sha256> --finding "<reported-finding>" --reason "<inspection evidence>" --approver "<reviewer>"
node tools/malware_guard/cli.cjs approve "<owner-added-file>" --owner-added --reason "<why this file belongs here>" --approver "<reviewer>"
```

Alternatively pass the top-level jar/ZIP as `approve`'s positional file instead
of `--sha256`. An archive approval binds its hash AND the finding's entry path;
changing any byte in that archive reflags the match. `--policy <file>` selects an
alternate approval registry. Owner-added approval only quiets drift; run `scan`
as well. Indexed folder packs are recognised per file, so unexpected new files
inside `evil-eye-cozy-overrides` still flag. Pinned jar/ZIP replacements also flag;
plain indexed settings remain installed even when the game changes their values.

The initial Stable review recorded 12 static approvals and six owner-added hashes,
with evidence in the two registries. The loader heuristic had three false
positives (Guava's finalizer loader and classpath enumerator; Reflect's class-loader
API). The 34-project known-bad list records owner-supplied slugs/names and supports
future project IDs and SHA-256 hashes without pretending they are currently known.

Pack-test always saves offline security evidence; `--instance <.minecraft>` adds
drift. Analysis without `evidence/malware.json` is incomplete. For a historical
run, copy it first and explicitly capture new evidence from a verified matching
stage using `writeMalwareEvidence(stage, evidenceDir, { root, instance })` exported
by `session/security.cjs`; record that the security scan was captured later.
Never attribute a current scan to an old boot without checking pinned content.

Online status requires explicit invocation and a writable cache. For the
orchestrator's first authorised live check (not run during implementation):

```powershell
node tools/malware_guard/cli.cjs status --cache tools/malware_guard/.local/modrinth-status.json --ttl-hours 24
```

The cache stores version and project responses; `--ttl-hours 0` refreshes them.
Timeouts, rate limits and network failures say `not checked`, not healthy. A
404/410 means unavailable (possibly removed, hidden or inaccessible), not proof
of malware. This command never runs as part of the offline pack test.

## Known exceptions registry

Three lists record why something is deliberately hidden, missing or duplicated. Check them before
investigating an item, a pack-test finding or a duplicate group; when you add an entry, add its reason.

Acquisition analysis reads hidden-item classes and evidence from `hidden_reasons.json`
and includes them in `report.json`; do not repeat those ids in `policy.json` exclusions.

- `tools/dedup/hidden_reasons.json`: one reason (class, evidence, date, source) per id in `kubejs/config/dedup.json` `hiddenOnly`. `tools/dedup/tests/hidden_reasons.test.cjs` fails if an id has no reason or a reason names an id that is not hidden. The shipped `dedup.json` stays a plain array; reasons are never shipped (`tools/` is packwiz-ignored).
- `tools/pack_test/data/baseline.json` (with `policy.json`): known pack-test findings, each with a reason and date.
- `tools/dedup/allowed_groups.json`: duplicate material groups that are allowed to stay, each with a reason.

## Pack test (agents' acceptance command)

`node tools/pack_test/run.cjs` verifies a pack change without anyone playing. It checks the hash chain,
boots the checkout **once** on a hidden Forge dedicated server (no client, no window, `127.0.0.1` only,
offline) with a KubeJS probe injected into that throwaway server only, stops every process it started,
and writes `report.json` + `summary.txt` into its run folder. Run it after any pack-file change (after
`rehash.cjs` and `verify_hashes.cjs`), and read `summary.txt`.

- **Where it runs.** By default on **ANU** (see below). `--local` runs on Valhalla. The first line of
  `summary.txt` starts `mode: ...`: `anu (alone)`, `anu (shared with <job>)` or
  `local (fallback: <reason>)` (`local (--local)` when asked for). An unreachable ANU, a held pack-test
  lock or no room beside another project's job falls back to Valhalla at once; there is no waiting for
  ANU to become idle (`--anu-wait` is gone).
- **Output.** `C:/Users/dirty/projects/artifacts/evil-eye-pack/pack-test/runs/run-<time>/` by default;
  pass `--out <job folder>` to put the run there. A run folder holds `run.json` (what was tested: commit,
  dirty flag, pack/index hashes, seed, timings, boot result), `evidence/` (probe payloads, raw-resource
  scan, pack policy copies, logs, crash reports), `report.json`, `summary.txt` and, when there are new
  findings, `baseline-candidate.json`. The throwaway server itself is deleted (`--keep-server` keeps it).
- **Checks.** recipes (every ingredient resolves, outputs registered, conditional/empty-tag gating,
  parse failures), references (tags, loot tables, removed mods), acquisition (every expected item has an
  obtain method), machines (Create / Ender IO / Extreme Reactors type counts and key recipes), crafting
  (five curated crafts through a real crafting menu: Create andesite alloy, ER reinforced casing via
  Dark Steel, a Farmer's Delight dish, an AE2 component, the dough survivor with its bucket remainder),
  dedup (the duplicate-material guard on live tags), logs (the smoke's error groups plus per-resource
  load failures). Inputs: `tools/pack_test/data/{policy,crafts,machines,baseline}.json`.
- **Exit codes.** `0` complete run, no new findings; `1` new findings (listed in `summary.txt`);
  `2` invalid run: probe incomplete, crash, setup or cleanup failure. A baseline never turns 2 into 0.
- **Baseline review.** Known findings live in `data/baseline.json`, each with a reason. New ones are
  either fixed in the pack or, after review, copied from `baseline-candidate.json` with a real reason
  (never the `TODO`). Entries reported as "resolved" are removed. Acquisition gaps that are by design
  (trades, Java drops, in-world conversions, technical items) go into `data/policy.json` exclusions.
- **Re-analyse without booting:** `node tools/pack_test/run.cjs --analyze <run folder>` (same verdict
  from the saved evidence; use it after editing the baseline or the checks).
- **Options.** `--seed` (default `20261020`), `--fresh-world` (ignore the cached world),
  `--priority` (local JVM, default `AboveNormal`; ANU always runs at `BelowNormal`, alone or shared), `--timeout`, `--silent`,
  `--sample` (watchdog, as in the smoke), `--probe-timeout` (seconds allowed after `Done`, default 300),
  `--heap` (default `6G`), `--port` (default 25601). Java, the installer jars and the artifacts root come
  from `tools/server_smoke/env.cjs` (`SMOKE_*` overrides).
- **Timing (measured 2026-10-23).** Valhalla with the cached world: stage 3-6 s, raw scan 7-15 s, server
  copy 4-8 s, boot 100 s (Done at ~50 s, probe ~8 s, stop), about 2 minutes in all. ANU, first run (full
  765 MiB sync 56 s, fresh world, Done at 135 s): 4 minutes; later runs sync only changed files and reuse
  the world. A fresh world (new mod set or `--fresh-world`) adds 1.5 minutes or more. The first run after a
  pack change re-installs only the changed files into the stage.

### ANU (remote target)

ANU is the spare LAN PC (`ssh anu`, fallback `ssh anu-byname`). The pack test owns `G:\evil-eye-pack-ci\`
(README there explains layout, manual stop and clean-up) and `C:\Tools\evil-eye-pack\` (portable Node 22
and Temurin JDK 17, SHA-256-verified; `node tools/pack_test/remote/provision.cjs` installs them and is
idempotent; `run.cjs` calls it when they are missing). The machine PATH, JAVA_HOME and Defender are never
changed.

- Valhalla stages the pack (`artifacts/.../pack-test/stage/server`, incremental `packwiz -s server`),
  syncs only new or changed files to `G:\evil-eye-pack-ci\stage\server` (one tar over scp), resends the
  tool code, and starts `remote/agent.cjs` detached through `Win32_Process.Create` at BelowNormal (it
  survives the SSH session; Java inherits the priority).
- Two pack tests never overlap: a heartbeat lock in `G:\evil-eye-pack-ci\lock\` (stale after 10 min); a
  second run finds it held and falls back to Valhalla immediately.
- **Sharing with another project (owner ruling 2026-10-23).** While `G:\mods-ci\lock` is held by a live
  process, the run checks twice (before the sync, and again just before launching the agent) that ANU has
  room: free physical RAM >= 8 GB and the mean of 5 one-second CPU readings < 50%. If so it runs beside
  that job (`anu (shared with <job>)`) at BelowNormal, the agent and the server JVM it starts; otherwise it
  falls back to Valhalla. Without the neighbour's lock it runs `anu (alone)` with no load check.
  Thresholds are in `tools/pack_test/remote/config.cjs` (`PACKTEST_ANU_MIN_FREE_GB`,
  `PACKTEST_ANU_MAX_CPU_PCT`, `PACKTEST_ANU_CPU_SAMPLES`, `PACKTEST_ANU_CPU_SAMPLE_MS`); the decision is
  `remote/capacity.cjs`. The neighbour's `lock\pid`, `lock\job` and `queue\*.ticket` count are only read.
- **Starved shared runs.** A boot that never finished, with no crash and the JVM averaging under 0.25 cores
  (the smoke's HOST STARVED rule), is reported as `HOST STARVED` (exit 2, neighbour named, not a pack
  failure). When that happens on a shared run the pack test re-runs **once, automatically, on Valhalla**
  (its summary then says `local (fallback: shared ANU run beside <job> was CPU-starved)` plus a `note:`
  line); the same starvation on a run that is not re-run (alone, or the re-run itself) stays exit 2.
- The agent boots through the same code as a local run, keeps the evidence, deletes the server copy
  and releases the lock; Valhalla polls `status.json`, pulls the evidence back and analyses it locally,
  so exit codes and reports are identical. Ctrl+C on Valhalla also kills the remote agent and its JVM, but only while the agent is running and only when that PID's command line still holds the agent script and this run's job file (Windows reuses PIDs; ANU hosts other projects). A missing or unreadable lock `owner.json` counts as busy until the lock directory itself is stale.
- Protected on ANU, never touched: Plex and its boot task, `E:\`, `G:\Work`, `C:\ProgramData\CommandDeckCI\`,
  the `cd-ci` account, `G:\ci`, `G:\mods-ci` (only its lock `pid`/`job` and queue ticket count are read).

## Server compatibility smoke (agents)

`node tools/server_smoke/smoke.cjs [--pack <pack.toml>] [--out <dir>] [--drop oculus]` boots the checkout headless on a Forge 47.4.10 dedicated server (`-s server` install, nogui, hidden, localhost:25599, offline, fresh world; about 2.5 min on an idle host, 9+ min on a busy one, see GOTCHAS) and prints PASS/FAIL, time to `Done (`, crash causes and error groups (known noise vs new). Agents use this to check pack compatibility; the owner verifies in game. It never opens a window or touches MultiMC. Cache and runs live under the artifacts root in `server-smoke/` (pass `--out` to put a run in a job folder). Java, the packwiz jars, the artifacts root and the Forge version are all defined in `tools/server_smoke/env.cjs` (override with `SMOKE_JAVA`, `SMOKE_BOOTSTRAP_JAR`, `SMOKE_INSTALLER_JAR`, `SMOKE_ARTIFACTS`, `SMOKE_FORGE_VERSION`, `SMOKE_FORGE_URL`). `--seed <n>` (default `20261020`) sets `level-seed` so boots are repeatable; the seed is printed in the PASS/FAIL/STALL header and on every failure. A random seed made two of four boots stall in "Preparing spawn area". A timeout inside that phase with no crash and no new errors is reported as `STALL` (exit 3, "WORLDGEN STALL ... seed N"), not a pack FAIL: retry with another `--seed`. On such a timeout the smoke also saves a `jcmd Thread.print` to `stall-threads.txt` in the run dir (`SMOKE_JCMD` overrides the jcmd path). The wall-clock timeout is gone: a progress watchdog samples the JVM's CPU time every `--sample` s (default 10) and stops the boot only when the log is silent AND CPU is flat for `--silent` s (default 180), with `--timeout` (default 1800 s) as a hard cap. Right after spawn the server JVM (the spawned `java.exe` itself, no wrapper) is raised to `--priority` (default `AboveNormal`; `Idle|BelowNormal|Normal|AboveNormal|High|none`) because Windows starves it while the host is busy. The header prints `JVM CPU` seconds, wall seconds and priority. A non-finishing boot with no crash and no new errors where the JVM averaged under `--starved` cores (default 0.25) per wall second is labelled `HOST STARVED` (exit 4), distinct from `STALL` (worldgen, exit 3) and `FAIL`: retry on an idle host or with `--priority High`. `--drop` deletes installed jars from the throwaway server only, to find the next offender; `--analyze <run dir>` re-reports a finished run.

## Custom mods

The owner's own mods are built in the `minecraft-mods` workspace (`C:/Users/dirty/projects/minecraft-mods`, one repo per mod under `mods/`, e.g. `mods/DankRecipeTransfer` = `dirtyredz/dank-recipe-transfer`). Release workflow: tag and publish the jar as a GitHub release, compute its sha256, then edit the pack's `mods/<id>.pw.toml` (`filename`, `url`, `hash-format = "sha256"`, `hash`; no `[update]` section), run `rehash.cjs` and `verify_hashes.cjs`, and run the server smoke. The pack never stores the jar.

## Job artifacts (agent dispatches)

Every dispatch gets its own `projects/artifacts/evil-eye-pack/jobs/<YYYY-MM-DD-task>/`.
`--prompt-file`, `--output-file` and any shell redirection go inside it, never in
`projects/` or the repo. The migration record of the files moved there on 2026-10-11 is in
`jobs/2026-10-11-layout-migration/artifact-moves.md`.

## Worktrees

- Create: `git worktree add ../worktrees/evil-eye-pack/<name> -b <branch>` from the main checkout.
- Move: only `git worktree move <old> <new>`. Stop its server first. Never move it in Explorer
  and never `git worktree prune` during recovery.
- Retire: archive results, keep a branch or tag, then `git worktree remove` a clean worktree.

## Backup and restore

- Backup: close MultiMC and Minecraft, then copy the whole instance folder plus
  `MultiMC/multimc.cfg` and `MultiMC/instances/instgroups.json` into
  `MultiMC/backups/evil-eye/<instance>/<timestamp>/`, and compare file counts and SHA256 with the
  original. `jobs/2026-10-11-layout-migration/backup-instances.ps1` does this.
- Restore: close MultiMC, replace the instance folder with the backup's `instance/` and put
  back the two launcher files.
- Undo the 2026-10-11 rename: close MultiMC, rename `Evil Eye Stable` back to `Evil Eye Dev1`,
  restore its `instance.cfg` and `multimc.cfg` from the backup.
- Undo the worktree move: `git worktree move ../worktrees/evil-eye-pack/emi-trial ../evil-eye-pack-emi`.

## Acceptance checklist (manual, owner)

- [ ] Each test instance installs from its own checkout: its pre-launch path matches the table above.
- [ ] A reversible uncommitted change reaches only its test instance, with no commit or push.
- [ ] Testing in Local or the trial leaves `Evil Eye Stable` unchanged.
- [ ] With the checkout's `pack.toml` unreadable or a hash wrong, the test instance's launch fails visibly; abort rather than continue.
- [ ] After the rename, Stable shows one entry, Minecraft 1.20.1, Forge 47.4.10, and its worlds, settings, waypoints and `packwiz.json` are intact.
- [ ] The EMI trial sync installs EMI/JEI/JEP and removes the REI jars and `rei_filter_toggle.js` (see `docs/emi.md`).
- [ ] Restoring an instance backup and the reverse worktree move both recover the recorded baseline.
