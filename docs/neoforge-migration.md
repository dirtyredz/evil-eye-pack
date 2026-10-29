# NeoForge 1.21.1 migration

Moves Evil Eye from Forge 47.4.10 / Minecraft 1.20.1 / Java 17 to NeoForge 21.1.265 /
Minecraft 1.21.1 / Java 21 on the long-lived branch `migration/neoforge-1.21.1`. `main` and
the Stable instance stay on Forge until the owner declares the candidate 100% (Phase 10).
Plan: `artifacts/evil-eye-pack/jobs/2026-10-29-neoforge-migration-plan/plan.md`; Docket parent
`dk-876bc6ca`.

## Phase status

| Phase | Item | Status |
|---|---|---|
| 1 Isolate worktree, instance and evidence | dk-00608fcb | done 2026-10-29 |
| 2 Resolve and lock target artifacts | dk-1254cf3d | done 2026-10-29 (lock and tool; re-point proven by dry run only) |
| 3 Runtime-aware testing | dk-b28c4c95 | done 2026-10-29 (fast gate; first real NeoForge install/boot is Phase 6) |
| 4 Data scanners and metadata | dk-2978dc2f | done 2026-10-29 (fixtures; real target evidence arrives in Phase 6) |
| 5 Activate pins, swaps, configs, KubeJS 2101, dedup | dk-960e6d58 | done 2026-10-29 (static; first-boot checks listed below) |
| 6 First clean target boot | — | todo |
| 7 Interstellaris stack | — | todo |
| 8 Seven owned ports | — | todo |
| 9 World conversion on a copy | — | todo |
| 10 Qualify 100% and cutover | — | todo |

## Isolation (Phase 1)

| What | Where |
|---|---|
| Branch / worktree | `migration/neoforge-1.21.1` at `C:/Users/dirty/projects/.worktrees/evil-eye-pack/migration/neoforge-1.21.1` |
| Trial instance | `C:/Users/dirty/MultiMC/instances/Evil Eye NeoForge Trial/`: fresh (no saves, mods, logs or `options.txt`); `mmc-pack.json` components `net.minecraft` 1.21.1 + `net.neoforged` 21.1.265 (the packwiz installer never sets the loader) |
| Java 21 | `C:/Tools/evil-eye-pack/temurin-21/bin/java.exe`: Temurin 21.0.13+9, zip SHA-256 `a4dbaa05fca4bd89d84584e58c459bd732efebb1722af80ab13c6516832004f9` checked against the Adoptium API. The trial instance and `server_smoke/env.cjs` name it explicitly; global Java, PATH and JAVA_HOME are untouched |
| Trial prelaunch | the shared packwiz bootstrap with this worktree's `pack.toml` file path |
| Migration jobs | `artifacts/evil-eye-pack/jobs/2026-10-29-neoforge-*/` |
| Verified target artifacts | `artifacts/evil-eye-pack/migration/neoforge-1.21.1/cache/{mods,resourcepacks,shaderpacks,installers}/` |

Since Phase 5 the worktree's `pack.toml` is the NeoForge 1.21.1 target, so the trial instance would
install it. No boot or client launch has happened yet. The first target boot is Phase 6, coordinated
with minecraft-mods for the machine.

Pushing the migration branch is safe for Stable: Stable's prelaunch reads `main`'s raw
`pack.toml` URL. Push only the migration ref; never `main`.

Starting evidence (2026-10-29): `jobs/2026-10-29-neoforge-isolation/stable-evidence.json`, with
its recorder `evidence.mjs` beside it. `main`, `origin/main` and the published ref were all
`ebcd9e8`. Stable ran Minecraft 1.20.1, Forge 47.4.10 and Java 17.0.10, with its prelaunch on the
GitHub `main` URL, 182 installed jars hashed and one save (`New World`). Evil Eye Local was
unchanged. Before any later phase gate, re-run `node evidence.mjs --check stable-evidence.json`.

## Target lock (Phase 2)

`tools/packwiz/migration/target-lock.json` is built from the availability survey
(`jobs/2026-10-29-neoforge-availability/bulk-results.json`) plus the reviewed decisions in
`tools/packwiz/migration/dispositions.json`. Every target byte is downloaded and checked
against what its publisher states, and the dependency closure is read from actual jar metadata.

```powershell
node tools/packwiz/migrate.mjs resolve   # fetch + verify (cached), read metadata, closure, write the lock
node tools/packwiz/migrate.mjs check     # offline: lock vs checkout fingerprint, every cached byte, closure
node tools/packwiz/migrate.mjs apply     # dry run (default): planned writes/deletes
node tools/packwiz/migrate.mjs apply --write   # Phase 5 only, then rehash.cjs and verify_hashes.cjs
```

Coverage on 2026-10-29: **191 source metafiles accounted for exactly once.** That is the 182 mods
plus 6 resource packs and 3 shader packs, with 4 additions.

| Action | Count | Entries |
|---|---:|---|
| repoint | 170 | 169 mods to their exact NeoForge 1.21.1 file (Hourglass and Ranged Pumps move from Modrinth to CurseForge), plus MakeUp Ultra Fast 8.8f → 9.6 |
| retain | 8 | 6 resource packs and 2 Complementary shader packs already tagged 1.21.1 |
| replace | 3 | Oculus → Iris 1.8.14-beta.1; Steam 'n' Rails → the NeoForge port 0.3.0-beta.2; CullLessLeaves Reforged → the NeoForge port 1.4.3 (GitHub, sha256-pinned) |
| drop | 3 | MemoryLeakFix (ModernFix kept), Embeddium (superseded by Sodium), Radium Reforged (Create 6.0.10 declares it incompatible) |
| defer | 7 | the seven owned ports below |
| add | 4 | Sodium 0.8.13 (Iris), Prickle 21.1.11 (AttributeFix, Enchantment Descriptions), Lithostitched 1.8.1 (Terralith), Lionfish API 3.1 (Cataclysm) |

The closure has 0 errors and 1 warning: Supplementaries bundles a Forge-tagged MixinSquared
in its jar-in-jar. 22 kept mods are on a beta-channel file. The installer is
`neoforge-21.1.265-installer.jar`, sha256 `a547ccc3…d1a2`, checked against Maven's `.sha256`.

**Frozen pins (agreed with minecraft-mods 2026-10-29):** NeoForge 21.1.265 and
JEI `jei-1.21.1-neoforge-19.70.0.464.jar` (beta), EMI `emi-1.1.24+1.21.1+neoforge.jar`,
Polymorph `polymorph-neoforge-1.2.0+1.21.1.jar` (beta) and Dank Storage
`dankstorage-neoforge-1.21.1-20.jar`. The ports' stated targets are NeoForge 21.1.265, JEI
19.70.0.464 and Polymorph 1.2.0; the lock records the agreement under `frozen`.

## Runtime-aware testing (Phase 3)

`pack.toml [versions]` decides the runtime (`tools/server_smoke/runtime.cjs`). Each loader runtime
has its own loader base, local stage, cached worlds and ANU lane:

- Loader base: `server-smoke/cache/loader-base/<runtime id>/`. The installer is checked against
  Maven's `.sha1` (Forge) or `.sha256` (NeoForge) and stamped with `runtime.json`.
- Local stage: `pack-test/stage/<runtime id>/server/`. A stage that has no stamp, or was stamped
  for another runtime, is rebuilt.
- Cached worlds are keyed by runtime, seed, profile, jar bytes and world-shaping config. They
  carry the stamp, and restoring one into another runtime's server is refused.
- ANU: Forge keeps `stage\server`, `cache\worlds` and `tools`. NeoForge uses
  `lanes\neoforge-1.21.1-21.1.265\{stage\server,cache\worlds,tools}`. The single `lock\` stays
  shared. Temurin 21 is provisioned beside 17 under `C:\Tools\evil-eye-pack\temurin-21`.

## Owned ports (deferred, never abandoned)

Seven mods have no NeoForge 1.21.1 build and are being ported by the owner in `minecraft-mods`:
Dank Recipe Transfer, Roundwood, Ars Instrumentum, Alex's Mobs, Alex's Caves, Ice and Fire, and
FlatWorldFix. FlatWorldFix is kept and ported, not swapped for Give Me My Flat World. The lock
records each one as `defer`. Phase 5 suspends their references, and each one returns as a direct
GitHub release pin.

## 100% checklist

See plan Phase 10. Every criterion there is required. Temporary absences, a successful boot on
its own, or a world saved without its content never satisfy it.

## Data tooling (Phase 4)

`tools/data_io/resource_layout.cjs` recognizes both data layouts for the pack-test raw scan and
dedup. The raw scan reads the NeoForge universal jar and refuses an empty scan, and conditions
accept `neoforge:conditions` and `neoforge:` types. Probes and showcase checks work on both
runtimes: RecipeHolder, the reloadable loot-table registry, NeoForge FakePlayerFactory, component
patches, level capabilities, and startup-script globals. The mod map treats `neoforge` as the
platform, records incompatible and discouraged entries as conflicts, and enables NeoForge's FML
TRACE logger. The NeoForge TRACE wording is unverified, so timings stay "unmeasured" if it differs.
The malware guard scans NeoForge jars the same way, and approvals stay bound to the exact hash.

## Activation (Phase 5)

- **Lock applied** with `node tools/packwiz/migrate.mjs apply --write`, then rehash.
  `migrate.mjs check` now verifies that the checkout matches the applied target exactly, and
  `verify_hashes.cjs --jars <cache>/mods` checks all 176 jars.
- **Swaps** came from the lock: Iris + Sodium, the Steam 'n' Rails port and the CullLessLeaves port;
  MemoryLeakFix, Embeddium and Radium were dropped. Oculus, Embeddium, Radium and MemoryLeakFix are
  now `removedMods` in pack-test policy.
- **Supplementaries' Forge-tagged jar-in-jar** is MixinSquared's single Forge-family artifact with
  `FMLModType: GAMELIBRARY`. NeoForge loads it as a game library and never reads its
  `mods.toml`, so it is expected, and the closure check no longer warns about it (0 warnings).
- **Deferred ports** are parked in `tools/packwiz/migration/deferred/`; its README has the restore
  steps.
- **KubeJS 2101 / EMI curation:** `startup_scripts/globals.js` creates the globals, listeners go
  through `NativeEvents` (`ui/native_hooks.js`), the key mapping uses NeoForge classes, and
  components are translated in `java_interop.js`.
- **Configs:** `tools/packwiz/migration/config-decisions.json`.
- **Dedup** was regenerated against the verified target jars: 82 overrides, 25 removed recipes and
  86 stale 1.20 outputs deleted. The Dragons Plus static sanding recipes (268) moved to the 1.21
  layout. Policy changes are recorded in `tools/dedup/migration-1.21.json`.

### Checks only the first target boot or launch can settle (Phase 6)

- **KubeJS 2101 behaviour:** that nested property writes on startup-created globals are allowed;
  `NativeEvents.onEvent` with a class-name string; `JsonIO.read` shape; `removeAllTagsFrom` and
  the recipe-event calls in `dedup.js`/`uranium.js`.
- **Configs:** each `regenerate` config against the target's generated defaults (renamed or removed
  keys reviewed, intent reapplied); client-only defaults at the owner's first launch.
- **EMI curation:** Ender IO's soul vial and broken spawner keep rule (`rules.json`
  `keepWhenNbtEquals`) still describes the 1.20 `BlockEntityTag` NBT. It must be rewritten for the
  1.21 `enderio:stored_entity` component layout seen in game. Until then the zombie vial and spawner
  are hidden in CLEAN.
- **Showcase and probes:** level capabilities, RecipeHolder and loot registry access in a live
  server.
