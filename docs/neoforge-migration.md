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
| 6 First clean target boot | dk-626ee53d | done 2026-10-30 (ANU pack test PASS; see below) |
| 7 Interstellaris stack | dk-7bcd9303 | done 2026-10-30 (ANU boots green; showcase checks below) |
| 8 Seven owned ports | dk-279913bb | done 2026-10-30 (ANU and full showcase PASS; config/worldgen follow-ups below) |
| 9 World conversion on a copy | dk-064ce2a5 | done 2026-10-31 brief: dev.4 conversion/restart 68/68; owner Trial copy ready |
| 10 Qualify 100% and cutover | — | tooling ready 2026-11-01 (dry-run + copy rehearsal proven); cutover waits for owner sign-off |

## Isolation (Phase 1)

| What | Where |
|---|---|
| Branch / worktree | `migration/neoforge-1.21.1` at `C:/Users/dirty/projects/.worktrees/evil-eye-pack/migration/neoforge-1.21.1` |
| Trial instance | `C:/Users/dirty/MultiMC/instances/Evil Eye NeoForge Trial/`: fresh (no saves, mods, logs or `options.txt`); `mmc-pack.json` components `net.minecraft` 1.21.1 + `net.neoforged` 21.1.265 (the packwiz installer never sets the loader) |
| Java 21 | `C:/Tools/evil-eye-pack/temurin-21/bin/java.exe`: Temurin 21.0.13+9, zip SHA-256 `a4dbaa05fca4bd89d84584e58c459bd732efebb1722af80ab13c6516832004f9` checked against the Adoptium API. The trial instance and `server_smoke/env.cjs` name it explicitly; global Java, PATH and JAVA_HOME are untouched |
| Trial prelaunch | the shared packwiz bootstrap with this worktree's `pack.toml` file path |
| Migration jobs | `artifacts/evil-eye-pack/jobs/2026-10-29-neoforge-*/` |
| Verified target artifacts | `artifacts/evil-eye-pack/migration/neoforge-1.21.1/cache/{mods,resourcepacks,shaderpacks,installers}/` |

Since Phase 5 the migration worktree's `pack.toml` is the NeoForge 1.21.1 target. Phase 6 and
Phase 7 acceptance boots are recorded below. The private-port integration uses the dev/trial
wrapper described below; no client has been launched by this integration task.

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
node tools/packwiz/migrate.mjs apply --write   # then rehash.cjs and verify_hashes.cjs
```

The lock records its source commit (`source.commit`, e99fd1f). After apply the checkout is the target,
so a later `resolve` (a port pin, a Phase 7 addition) exports that commit's metafiles to
`.tmp/migration-source/`, checks they reproduce the lock's fingerprint, and resolves from them; `apply`
then writes only what the updated lock changes on the applied checkout, and refuses a metafile the lock
does not account for. Re-resolving an unchanged disposition reproduces the lock byte for byte.

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

**Pre-handoff gate:** in addition to the fast gate and dedicated-server acceptance,
run the [client mixin audit](development.md#client-mixin-audit-neoforge-1211) on the
exact pinned candidate before any owner launch. Require exit 0, a completed nonempty
CLIENT sweep and no diagnostic exclusions. Server success alone cannot qualify client
mixins. DRT 0.2.0 remains the negative acceptance fixture; DRT 0.2.1 passed the complete
pin sweep and dk-d4a36381 is closed.

The initial strict audit also exposed a Thirst/Jade injection failure and unresolved
missing/unapplied targets. Jade is pinned back to 15.10.3, whose `FluidView.readDefault`
bytecode matches Thirst 2.1.5; the six bootstrap-layer targets and 14 absent optional/no-op
targets have exact reasoned entries in `tools/client_mixin/allowlist.json`. Steam 'n' Rails
still targets the pre-1.21 Controls-screen package; the owner accepted that non-crashing
cosmetic behavior loss as an exact `known-minor` exception while dk-2d33cee0 remains open.
Triage evidence is under `jobs/2026-10-31-client-mixin-triage/`.

Observed on Valhalla (2026-10-31 brief; JVM time excludes staging/host waits):

| Inputs | Target sweep | Result | JVM time |
|---|---|---|---|
| Pre-triage pins, DRT 0.2.0 | 266 configs / 1819 targets | FAIL: DRT `VerifyError`, Thirst/Jade injection error, missing/unapplied targets | 265.649 s |
| Pre-triage pins excluding only DRT | 265 configs / 1818 targets | FAIL: DRT error absent; Thirst/Jade, 15 missing-target warnings and 7 unapplied targets remain | 245.498 s |
| Final pins, DRT 0.2.1 + Jade 15.10.3 | 266 configs / 1819 targets | **PASS**: all targets verified; 15 exact reviewed missing targets and six exact reviewed bootstrap targets | 230.161 s |

Final evidence is `jobs/2026-10-31-drt-021/client-audit-all-pins/`: verdict exit 0,
no verifier/mixin/injection errors and no failed target. The fresh-world ANU pack test
`run-2026-10-30T18-10-55-205Z` also passed alone (Done 89.206 s, probe complete,
zero new findings). No visible game window was opened.

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

## Upstream 1.20-layout data (restored 2026-10-30)

Several 1.21.1 jars still ship data only in 1.20 folders (`loot_tables/`, `recipes/`, `tags/blocks/`), so the
game never loads it. Of 77 such files on boot 8, Epic Witch Huts' 10 chest tables already have 1.21 twins in
the same jar. The pack restores the rest that matter as 1.21 files under `kubejs/data/<ns>/`, translated
where 1.21 changed the format (silk-touch `match_tool` → `predicates."minecraft:enchantments"`,
`looting_enchant` → `enchanted_count_increase`, `copy_name` → `copy_components`, recipe `result.item`
→ `result.id`):

| Restored | Files | Effect |
|---|---:|---|
| MCA headstones, rose gold block, books, villager / zombie villager / Grim Reaper tables | 26 | graves drop themselves (silk touch) or cobblestone + bones/skulls; rose gold block drops itself |
| Citadel `blocks/lectern` | 1 | its lectern drops a lectern, keeping a custom name |
| Waddles `entities/adelie_penguin` | 1 | penguins drop cod (looting adds) |
| Create: Interiors kelp seats/chairs, seatwood planks, wall table | 8 | the recipes exist again |
| `ftbessentials:ignore_rtp`, `structurize:null_placement`, `diagonalfences:non_diagonal_fences` | 3 | block tags their code reads (RTP avoids leaves/bedrock, Structurize placement order, grass-topped walls stay straight) |

Left out, with the reason in `tools/pack_test/data/policy.json` `ignoredLayout`: two empty Ars Nouveau tables,
Dank Storage's empty `forge:wrenches`, Ender IO's `darksteel_upgrade` (no such serializer in Ender IO 8),
Extreme Reactors' Thermal compat and `dry_ice` (Thermal and Powah absent), Supplementaries' Inspirations compat,
and Macaw's Trapdoors' 16 family tags (no jar reads them). The translator was a one-off job tool
(`jobs/2026-10-30-neoforge-phase7/tools/translate.cjs`); it covers only the constructs these files use.

**Regression guard.** `tools/pack_test/checks/ignored_layout.cjs` sorts each other-layout file into covered
(loot table or recipe twin from any source; for tags, which merge, only the same jar's twin or the pack's
copy), accepted (policy reason, exact id or `<kind>|<ns>:*`) or lost. The references check fails on lost
files after a boot, and `tools/pack_test/tests/data/ignored_layout.test.cjs` checks every pinned jar in the
fast gate (it also fails on policy entries that no longer match anything). A new or updated jar with lost
data therefore fails before any boot.

## Owned ports (all seven integrated)

Seven mods had no NeoForge 1.21.1 build and were ported by the owner in `minecraft-mods`:
Dank Recipe Transfer, Roundwood, Ars Instrumentum, Alex's Mobs, Alex's Caves, Ice and Fire, and
FlatWorldFix. FlatWorldFix is kept and ported, not swapped for Give Me My Flat World. The lock
initially recorded each one as `defer`. Phase 5 suspended their references. Public ports return
as direct GitHub release pins; private Alex ports use `local` pins (both are `repoint` actions).
Restoration history is in `tools/packwiz/migration/deferred/README.md`.

| Port | Pin | Integrated |
|---|---|---|
| Dank Recipe Transfer | 0.2.1 prerelease, `dank_recipe_transfer-1.21.1-neoforge-0.2.1.jar`, sha256 `9921f8fd…b8ef` (built from 6605b8d) | 2026-10-31 (replaces 0.2.0's client verifier failure; parked nothing; malware guard clean) |
| Roundwood | 0.17.0 prerelease, `roundwood-1.21.1-neoforge-0.17.0.jar`, sha256 `b6877267…c006` (built from 5e8988e) | 2026-10-30 (parked nothing; ids unchanged so `decor.json` stays; malware guard clean) |
| FlatWorldFix | 1.0.0, `flatworldfix-1.21.1-neoforge-1.0.0.jar`, sha256 `90a6da88…b996` (built from 26b2fd2) | 2026-10-30 (parked nothing; malware guard clean). First run against Terralith 1.21.1: every showcase boot now checks four far Superflat columns (`tools/showcase/flat_world.js`) |
| Ars Instrumentum | 5.0.0 (public LGPL fork), `ars_instrumentum-1.21.1-neoforge-5.0.0.jar`, sha256 `6d62964a…fb4e` (built from dc29a50) | 2026-10-30 (client config restored; needs Ars Nouveau ≥ 5.13.3; malware guard clean) |
| Alex's Mobs | private 1.22.9, local SHA-256 `dc89b990?fa21` | 2026-10-30 (configs and hidden-item policy restored; Citadel 2.7.1 already locked; malware clean) |
| Alex's Caves | private 2.0.2 r2, local SHA-256 `9c3962cd?8408`, built from 1d29b6b6 | 2026-10-30 (configs, uranium progression, chocolate sanding and baseline restored; malware clean) |
| Ice and Fire CE | private 2.1.4, local SHA-256 `71fc6472?02d0`, built from 6118f541 | 2026-10-30 (configs, silver/sapphire deposits, copper and witherbone dedup restored) |

Alex's Mobs, Alex's Caves and Ice and Fire use local-source pins (below). All seven ports are
`requiredMods`, along with I&F's Uranus 3.0-beta.1 and Jupiter 2.3.7 libraries. No lock entry remains `defer`.

## Profiler (spark, 2026-11-01)

spark 1.10.124 (Modrinth `l6YH9Als` / `v5qtqRQi`, side both) is a lock `addition` for in-game and server profiling (`/spark profiler`). Its jar bundles async-profiler natives and ByteBuddy attach classes, which the malware guard flags (8 findings); they are approved against the exact jar with the reason recorded in `tools/malware_guard/data/allowlist.json`. The jar is in both the migration cache and the Trial cache (`jobs/2026-10-31-world-trial-final/cache/mods`).

## Flywheel with shaders (Iris Flywheel Compat, 2026-11-01)

A Spark profile of the Trial with Iris + Complementary Unbound showed Create kinetic block entities drawn on the CPU (~8.2% of the render thread). Cause: Flywheel 1.0.6 registers its `flywheel:instancing` and `flywheel:indirect` backends with a `supported` check that includes `!ShadersModHelper.isShaderPackInUse()` (`dev.engine_room.flywheel.backend.Backends`), so with a shaderpack both are unsupported and the backend falls to `flywheel:off`. Separately, the shipped `config/flywheel-client.toml` still carried the Flywheel 0.6 value `backend = "INSTANCING"`; 1.0 parses it as `minecraft:INSTANCING` and logs `Backend with ID 'minecraft:INSTANCING' is not registered` (Trial `latest.log`, 2026-11-01 01:57:33).

Fix: Iris & Oculus Flywheel Compat 2.4.0 (Modrinth `ndHYMY2K` / `6ZQz5Ow2`, client side; needs Iris >=1.8.1, Sodium >=0.6.9, Flywheel >=1.0.6) merges Flywheel's shaders into the pack's `gbuffer_block` program, plus `backend = "DEFAULT"` in the shipped config and `trial-owned-keys.json`. The first attempt (def8401) set `flywheel:instancing`, which never engaged: irisflw does not enable that backend, it registers its own `irisflw:iris_instancing` (priority 2000, supported only with a shaderpack), and Flywheel's `chooseBackend` only falls back to LOWER priorities (instancing 500 -> off). `DEFAULT` picks the highest-priority supported backend: irisflw with shaders, Flywheel's own without. Fallback if a shaderpack misbehaves: Colorwheel 1.3.0 (needs pack-specific support and is declared incompatible with this mod; never install both).

## Light Overlay removed (2026-11-01)

Owner does not use it. `mods/light-overlay.pw.toml` (12.0.0), `config/lightoverlay.properties`, its F7 default keybinding and its mod-map category are gone; the lock records a `drop` and `lightoverlay` is in `removedMods`. It was client-only and registers no blocks, items or entities (jar: 62 KB, only `META-INF/neoforge.mods.toml` plus client code), so no world data is affected. Architectury stays (FTB Library and Quick Skin require it). Cloth Config stays: only FallingTree still lists it, as an optional client dependency for its config screen.

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
  components are translated in `java_interop.js`. The 2026-10-31 client-tick fix removes Rhino
  equality checks on raw Java references, uses the component adapter on classification-cache hits,
  and builds uncached index views in private 256-item/4-ms slices before one publication. CLEAN's
  authored recipe-display filtering is unchanged. The owner must still qualify this in the Trial.
- **Configs:** `tools/packwiz/migration/config-decisions.json`.
- **Dedup** was regenerated against the verified target jars: 82 overrides, 25 removed recipes and
  86 stale 1.20 outputs deleted. The Dragons Plus static sanding recipes (268) moved to the 1.21
  layout. Policy changes are recorded in `tools/dedup/migration-1.21.json`.

## First clean boot (Phase 6)

Every boot ran as an ANU pack test (`node tools/pack_test/run.cjs`, shared lease, BelowNormal, alone).
Evidence for each is in `artifacts/evil-eye-pack/jobs/2026-10-29-neoforge-first-boot/` (`run<N>.log`
plus `run-<time>/`).

| Boot | Outcome | Cause found, fix |
|---|---|---|
| 1 | setup failed | four CurseForge downloads timed out in the stage install (transient); rerun |
| 2 | setup failed | the two-JDK provisioning script went over cmd.exe's 8191-character limit on ANU; split per tool, and `ssh.ps` refuses oversized commands |
| 3 | Done 79 s, probe complete, 344 new findings | first real target evidence; round-1 fixes (HammerLib `c:` tag config, dye and mud tag aliases, CEI XP-juice data map, machine floors, `transitional_item`, removed `ServerEvents.customCommand`, malware review, boot noise) |
| 4 | probe incomplete | the runtime probe's top-level `global` write is refused by KubeJS 2101, and the refusal aborts `ServerEvents.loaded` despite try/catch; removed |
| 5 | Done, 153 new findings | round 2: other-version data folders, 1.21 `loot_table` `value`, Ender IO component rule, HammerLib stone gear, smokestack policy, baseline review |
| 6 | **PASS** (exit 0) | clean shutdown, all probes token-matched; post-boot configs captured for reconciliation |
| 7 | **PASS** | after config reconciliation (401 configs unchanged by the mods, 0 dropped keys) and loot-condition gating |
| 8 | **PASS** | final verification with the settled runtime probe (cached world: Done in 2.7 s server time, 58 s wall) |

**KubeJS 2101 assumptions, observed live** (runtime probe and boot 4):
- A client or server script setting a top-level `global` value is refused, and the error aborts the
  whole handler.
- Adding properties to objects that a startup script created on `global` works.
- `NativeEvents.onEvent('<class name string>', fn)` registers and fires (checked with
  `ServerAboutToStartEvent`).
- `JsonIO.read` returns a JS object whose Java lists index and iterate.
- The recipe and tag events in `dedup.js` and `uranium.js` (removed in Phase 7) work: 25 recipes removed, survivor tags
  applied, and the machines and dedup checks pass.

**Ender IO curation rule:** Ender IO 8 stores the captured entity in the `enderio:soul` component
(`{entity_tag:{}, entity_type:"minecraft:zombie"}` on the creative broken spawner). `rules.json` now
keeps exactly that.

**Configs:** see the reconciliation note in `config-decisions.json`. No shipped value was reset.
87 files now ship the 1.21.1 mods' own write-back (with our values kept). Three relocated
default-only files were removed.

**Data a mod ships in the other version's folder layout is never loaded.** The scan records it. Phase 6
reported it as info; since 2026-10-30 it is restored or reasoned, and anything else fails (see Phase 7).

### Owner checks only a client can do

- **Rendering and shaders:** Iris + Sodium with Complementary Unbound (now `iris.properties`),
  Chloride and Entity Culling.
- **EMI curation:** CLEAN/ALL, DECOR and Mods buttons, the mark-as-decor key (default D), the zombie
  soul vial and broken spawner shown in CLEAN, and `/kubejs reload` keeping state.
- **Client-only configs** (`*-client.toml`, Default Options keys): a server never loads them.
- **Visuals:** the showcase and storage transfers, which the headless checks cannot judge.

## Interstellaris stack (Phase 7)

Added in dependency order as lock `additions` (`dispositions.json`), each resolved, applied, malware-scanned and
booted on ANU before the next. Evidence: `artifacts/evil-eye-pack/jobs/2026-10-30-neoforge-phase7/boots/`.

| Boot | Change | Outcome |
|---|---|---|
| 1 | Dank Recipe Transfer 0.2.0 pin | PASS |
| 2 | 1.20-layout data restored + guard | PASS (lost 0) |
| 3 | Mekanism + Generators 10.7.19.85, no dedup yet (diagnostic) | 305 findings: 285 Mekanism chemical outputs the check read as items, 6 acquisition (Mekanism output keys), 14 duplicate groups |
| 4 | Mekanism with dedup, chemical registry in the probe | PASS |
| 5 | Sable 2.0.6 | one new error group (Dragons Plus physics entry for an unregistered block) |
| 6 | a `neoforge:conditions` override for it | same error: Sable's loader ignores conditions; recorded as known noise. Re-analysis of boot 5 (same index hash as the commit) PASS |
| 7 | Interstellaris 0.6.1 beta | 15 acquisition gaps (structure, Java-made, disabled teleporter), reasoned; re-analysis PASS |

| Jar | Source | sha256 (lock) |
|---|---|---|
| `Mekanism-1.21.1-10.7.19.85.jar` | Modrinth Ce6I4WUE / 5KzzycBT (main jar, not `-api`) | `004dbc9f…4f43` |
| `MekanismGenerators-1.21.1-10.7.19.85.jar` | Modrinth OFVYKsAk / a6gl7srE | `0e5783b1…4ba4ac` |
| `sable-neoforge-1.21.1-2.0.6.jar` | Modrinth T9PomCSv / fg9dTRz9 (bundles Veil 4.3.2, Sable Companion 1.6.0, Rapier natives) | `9c199157…a617c2` |
| `Interstellaris-0.6.1-beta-neoforge-1.21.1.jar` | CurseForge 1726656 / 9345861 (length + CDN MD5) | `61dee228…009644` |

**Dedup** (see DECISIONS 2026-10-30): survivors are the items already in the owner's worlds. Mekanism dusts go to
Ender IO/Create/CCA, uranium to Extreme Reactors' yellorium (Mekanism uranium worldgen off), Mekanism steel is
the only steel (the Dark Steel stand-in is gone), Interstellaris' iron/gold plates, gold wire and silicon go to
Create sheets, CCA gold wire and AE2 silicon. Create crushed tin/lead/osmium and ER's Mekanism fluid port are
unhidden. Ice and Fire now survives over Interstellaris silver (dk-d2c9d23b; integration below).

**Sable mixin triage.** Static: `jobs/2026-10-30-neoforge-phase7/tools/mixin-overlap.cjs` parses every pinned jar's
mixin configs and annotations (3218 mixin classes, 530 in Sable/Veil/Companion/Interstellaris) and finds 160
shared target classes. Only four same-method overlaps can actually clash (an `@Overwrite`, or two call-replacing
injectors on the same call):

| Target | Stack | Other | Verdict |
|---|---|---|---|
| `LevelRenderer#isSectionCompiled`, `#renderSectionLayer`, `#setupRender` (client) | Sable overwrite/redirect | Sodium overwrites | Sable ships separate vanilla and Sodium render paths and its mixin plugin picks one; it declares Sodium ≥ 0.8.12 (pack 0.8.13). Owner client check |
| `PlayerList#broadcast` (server) | Sable overwrite | Ars Nouveau, Steam 'n' Rails head injects | Applied without error on every boot (PlayerList loads at server start) |

The rest are injects that stack (Create, Iris, Sodium, Railways, Entity Model/Texture Features, ImmediatelyFast,
ModernFix, Chloride). Interstellaris' `CraftingMenu` redirect (research gate on `setRecipeUsed`) and Polymorph's
(`getRecipeFor`) touch different calls; the crafting probe passes. Runtime: boots 5 and 7 logged no mixin
failure, and the Create contraption showcase runs with Sable present (below).

**Showcase runs (local, flat world):** `mekanism_machines` 106/106 and `interstellaris_space` 128/128 pass, each
with the flat-world check (FlatWorldFix keeps Superflat flat with Terralith) and the 384 command-form assertions
across all three sections (`jobs/2026-10-30-neoforge-phase7/showcase-mek-14`, `showcase-is-8`). The initial storage failure (dk-54d65c18) was later traced to an unpowered hopper
pause in the harness; the diamond was in the output hopper, not lost (see the private-port job evidence).

**Interstellaris facts:** it gates crafting and its Fabrication Unit on per-player research
(`ResearchHelper.canUseRecipe`), and disables Mekanism's teleporters (dk-aef6fa66). Sable's Rapier natives are an
LZ4 archive the malware guard cannot open (dk-59b7f4a1).

## Private Alex ports (dev/trial only, 2026-10-30)

Alex's Mobs 1.22.9 (SHA-256 `dc89b990?fa21`, 26356566 bytes) and Alex's Caves 2.0.2
(`2d7435f7?405c`, 74864451 bytes; built from 881d907b) use lock source `local`.
The lock and dispositions contain only hash/size artifact identities, never private URLs.
`metadata:local` metafiles fail closed without our wrapper. Store supplied, verified bytes as
`<migration cache>/mods/<sha256>.jar`; filename copies remain available to existing jar scanners.

The installed packwiz version rejects `file:///` in a download: `Expected URL scheme 'http' or
'https' but was 'file'` (isolated synthetic fixture, no client launched). `local_source.cjs` instead
builds a gitignored `.tmp/private-pack-*` overlay, rehashes it, and serves only the locked bytes on
`127.0.0.1` at an ephemeral port while packwiz runs. It closes the listener and removes the overlay
even when installation fails. The tracked pack never contains those URLs. `server_smoke` and
`pack_test` use this same route; ANU receives the already staged, verified jars.

The owner-only local-delivery ruling (2026-10-31, dk-85261627) supersedes the earlier
family-hosting question. The final Trial uses `scripts/migration/trial-walkthrough.ps1`:
verified cache jars are ordinary files in a gitignored temporary pack, so packwiz copies
them directly into the Trial and tracks them on subsequent launches. No host, public URL
or download is needed. The wrapper sets only Trial prelaunch to repeat the same offline
install, and removes its temporary pack afterwards. Stable and Local remain refused.
Cutover reuses this local-copy route under its separate authorization. The old loopback
wrapper remains available for server staging; the owner Trial does not need it.

Both malware scans have zero findings (Mobs: 5106 files; Caves: 8189). Parked configs, curation
reasons, acquisition baselines, chocolate sanding and uranium recipes are restored. Uranium and
sulfur decisions are in DECISIONS and duplicate-cleanup. Evidence lives under
`artifacts/evil-eye-pack/jobs/2026-10-30-alexsmobs-pin/`.

First integration boot reached Done and completed all probes, with two empty-tag recipes and
twelve added End Pirate/purpur blocks lacking acquisition. The pack now bridges `c:concrete`
to `alexscaves:concrete` and mirrors the 29 cave-painting blocks into the item tag Supplementaries
uses. The extra Mobs blocks have no producers in either data or class-reference inspection;
reviewed per-item baselines and dk-e828975c retain that handoff to minecraft-mods. No jar patched.

Acceptance: `step1-boots/run-2026-10-30T05-30-39-317Z` **ANU PASS** (Done 87.606 s wall,
probe complete, exit 0). Full fast gate 495/495 before final staging checks; final touched suites
pass, including hash verification after install and smoke process-scope ownership. `migrate check`
has zero missing artifacts, dependency errors or warnings. Main/Stable/Local evidence unchanged.

Storage investigation: `storage-diagnostic` reproduced 31 mounted diamonds and found the 32nd
in the output hopper. Total 48 (mounted plus input chain) conserved. No Dank dock or DRT transfer
was involved. The harness now powers both hoppers during exact accounting; its rebuild removes
that temporary power before automatic flow. No jar change or skipped assertion.

Step 2 acceptance: `showcase-all-arrival` **PASS 1277/1277** (storage 657, Interstellaris 128,
Mekanism 106, flat-world 2, command forms 384), no skipped assertions. The first full run also
exposed same-tick destination tracking after planet teleport; bounded later-tick arrival checks
fix that harness race. `step2-boots/run-2026-10-30T05-42-34-529Z` **ANU PASS**.

Roundwood curation (2026-10-30): `roundwood-legacy.json` lists 49 per-material legacy blocks
and the `window_trim` item alias, exactly 50 registered items. CLEAN hides them through the
existing curation item-list mechanism; ALL restores the ordinary index. Generic doors, trim,
windows and arches remain visible. No registry, world-migration or recipe changes. A pinned-jar
regression checks the exact set (excluding the unregistered `template_round_door` model).

Final acceptance: `step3-boots/run-2026-10-30T05-54-43-090Z` **ANU PASS**, complete probes,
zero new findings. Documented fast gate: **501/501** (113 s). Roundwood live-registry evidence
confirms all 50 items exist (49 blocks plus the alias). Rehash dry run is unchanged, hash and
lock verification pass, `dk check` has zero errors (two pre-existing duplicate-rank warnings),
and isolation evidence says `OK main, Stable and Local unchanged`. No visible client launched.

## Ice and Fire + Alex's Caves r2 integration (2026-10-30)

Evidence: `jobs/2026-10-30-iaf-integration/`. The private jars match the supplied hashes;
Uranus (CF 1010827/8682870) and Jupiter (CF 1072905/7738312) match the supplied SHA-256s
and use normal CurseForge metadata. All four malware scans have zero findings.
The lock contains 201 entries: 177 repoint, 3 replace, 3 drop, 8 retain and 10 add.

All parked I&F configs and silver/sapphire deposits return. Copper overrides are regenerated
from CE in the 1.21 layout rather than copying the parked 1.20 files. Shared deferred policies
are consumed; removed Myrmex eggs are excluded. Witherbone and silver survivor decisions
are in DECISIONS and duplicate-cleanup. The twelve creative End Pirate/purpur blocks use
`alexsmobs-creative.json` in CLEAN, preserving ALL. Alex's Caves r2 provides the painting
and concrete item tags, so both pack bridges are gone.

This isolated worktree keeps its copied migration cache under `.tmp/migration-cache`.
For checks here set `SMOKE_MIGRATION_MODS` to its absolute `mods` directory and pass
`--cache .tmp/migration-cache` to `migrate check`; the shared migration cache is unchanged.

CE configuration reconciliation: Jupiter reads `config/iceandfire/iaf-common.json` and
`iaf-client.json`, not the restored Forge TOML. The integration carries the old pack
griefing toggles, dragon flute/bite/dig behaviour, corresponding mob ranges/weights and
800-block spawn exclusion into that schema. `jupiter.json` ships its observed defaults.
Client keys come from CE's `IafClientConfig`; no client was launched.

The restored legacy biome lists/TOML remain for provenance, but CE does not read them.
Its structure sets and per-candidate probabilities replace the old per-chunk chances;
exact generation/biome parity is **dk-e7b276f4**, for review before world conversion.
CE's new dreadwood leaves/sapling have no loot/acquisition data. The owner designated them
unfinished creative-only content: `iceandfire-creative.json` hides them in CLEAN and ALL
restores them (**dk-ce8a67fc** done). The godly seeker is admin-only.
The old amythest egg baseline follows the port's corrected amethyst ID; the dreadwood
way sign follows Supplementaries' existing code-made compat signs.

Final acceptance: `boots/run-2026-10-30T07-15-13-297Z` **ANU PASS**, Done 68.29 s wall,
complete probes and zero new findings/log groups. `showcase-all-ready` **PASS 1279/1279**,
no skipped assertions or script errors. Initial showcase failed its moon-arrival query even
though the saved traveller was at the expected moon coordinates; the bounded entity-chunk
readiness preflight fixes that race (see GOTCHAS). The space display uses I&F silver.
Fast gate **504/504** (64 s), lock/hash/whitespace checks pass; `dk check` has zero errors
and two pre-existing duplicate-rank warnings. `OK main, Stable and Local unchanged`.
Final index SHA-256: `abb5dea6ca565c480feafa7fa9e068d84a9112c4290b97c7952dfa3d13e50cc6`.

## Stable world trial (2026-10-30): LOSS, cutover blocked

Evidence: `jobs/2026-10-30-world-trial/world-trial-report.md` and
`minecraft-mods-handoff.md`. The original and independent read-only snapshot have full
SHA-256 manifests. Forge and NeoForge boot only separate working copies. The new
`tools/world_trial/` CLI is documented in development; tests cover protected paths,
independent copying, NBT, inventories, comparisons and bounded probes.

The exact pinned Forge baseline completed 943 existing-chunk probes and stopped cleanly.
NeoForge conversion and restart completed the same 866 overworld / 77 Nether probes,
but both required termination after the shutdown grace period. Original-UUID player
load/save probes preserve ordinary inventory/ender-chest slot IDs and counts; they expose
lost Curios equipment and portable Dank frequency links. Four Dank backing stores retain
9,312 serialized items, which does **not** prove those items are accessible.

All 80 baseline starbuncle UUIDs are absent after conversion, including five named pets;
79 entity-load exceptions identify Ars Nouveau's Starbuncle NBT reader (`Not a string`).
An Ender IO primitive alloy smelter and its 20 coal disappear, as do four loaded
Supplementaries signposts. Two unloaded signposts still reference the absent registry.
All 26 wild dragon UUIDs, age and gender persist through restart; numeric variants map
to the equivalent CE names. Colony identity, owner, four citizens and five level-one
buildings persist, but request/work processing remains unqualified. No source AE2 cells,
Roundwood blocks or Ars Instrumentum stacks exist to qualify those migrations.
All 462,651 original silver positions were checked: 462,649 retain the exact I&F ID through
restart. Two become smooth basalt in both Forge and NeoForge, an explained baseline
change rather than a target-only remap; the strict positional comparison still exits 1.

This is not a validated owner copy. No `converted-for-owner/` is supplied. **dk-d35aac75**
tracks the migration blockers; **dk-064ce2a5** stays open until a fresh snapshot-based
rerun passes. No jars were patched and no instance was modified. The fast Node gate
passes 517/517; this does not override failed world acceptance.

## Phase 9 previous re-run (2026-10-30; superseded below)

Job: `artifacts/evil-eye-pack/jobs/2026-10-30-world-trial-2/`. The private
`evileye_migration` 0.1.0-dev.1 pin (minecraft-mods 8b30349, SHA-256
`dc072b8969960a5e3aac49016a48c9912ee558ee598d3415c8185a78968460a8`)
is required by pack-test. Keep it installed until every legacy chunk has been loaded and saved.

The fresh-world ANU pack test passes. The new snapshot-based conversion and restart each visit all 943
selected chunks and stop naturally (killed:false, crashed:false); both domain audits pass 67/68. A bounded 400-tick
forced-chunk probe observes all four citizens bound to colony 1; portable Dank item
lookups resolve all four backing stores (9,312 items total). The snapshot contains 79
starbuncles; the earlier Forge baseline's 80th was newly generated in that baseline.

Acceptance remains blocked: the legacy colony flag pattern list is discarded by the
target BannerPatternLayers codec. One player's persisted Polymorph recipe selection also resets;
full payload/terrain comparisons and multipart helper equivalence remain unqualified. The job's `minecraft-mods-handoff.md` records
the exact values and decoder evidence. See `world-trial-report.md` for the final
restart, semantic comparison, integrity evidence and owner walk-through checklist.
Original/snapshot hashes and main/Stable/Local isolation pass; Stable has not changed since
the snapshot. Fast gate: 520/520. Both Docket items remain open with claims released.
Do not install diagnostic copies; no owner copy is validated while any LOSS remains.

## Phase 9 final dev.4 check and owner walk-through (2026-10-31 brief)

Evidence: `artifacts/evil-eye-pack/jobs/2026-10-31-world-trial-final/` (machine timestamps
are 2026-10-30). One new working copy of the immutable snapshot; Forge baseline reused
read-only. Private bridge dev.4, minecraft-mods bd5f1ce, SHA-256
`bc150d3a9af7a102de2a39614f7f2a4458465c6f65f4f22a9b20b97e88f4a262`, 52,329 bytes.

Both conversion and restart pass **68/68** domain checks and visit **943/943** chunks.
Both stop naturally (killed:false, crashed:false; 245.092 s / 163.575 s total). All four
citizens bind live to colony 1; four Dank stores resolve 9,312 items. Flag conversion
is exact: legacy WHITE BASE becomes `{color:"white",pattern:"minecraft:base"}` and persists.
Both complete inventories cover 44,535 chunks with zero parser errors. Fast gate: **522/522**.

Owner/orchestrator acceptance: Polymorph SelectedRecipe reset is transient, not LOSS.
The domain audits are authoritative for this gate. Raw comparisons report 38,037 / 38,075
source-to-target differences and 3,183 conversion-to-restart differences; these overlap
fields/encodings, not deleted objects. Unqualified terrain/blocks, opaque entity and
block-entity payloads, inventory/saved-data payloads, colony work/requests, and I&F multipart
collision/damage remain owner checks. Rendering, EMI UI and Interstellaris travel require
the client. No new client or full-tier test was run. Phase 10 remains owner qualification.

Validated restart save: `C:/Users/dirty/MultiMC/instances/Evil Eye NeoForge Trial/.minecraft/saves/Evil Eye Converted (trial)/`.
Its in-game title remains **New World**; the folder identifies the trial. Independent copy,
463 files / 385,489,451 bytes, all copied hashes verified. Never downgrade this save.
Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/migration/trial-walkthrough.ps1`
from this checkout with MultiMC closed (`-DryRun` checks inputs). Then open MultiMC and
click Launch on **Evil Eye NeoForge Trial**.
The script resolves from its own directory, logs under `.tmp/owner-runs/`, uses the complete
job cache and sets only Trial's prelaunch to repeat the same install. After merge, run the
script from the retained migration checkout to bind prelaunch there before retiring this worktree.

Private delivery uses **direct local copying through packwiz**, with hash-verified jars
listed as ordinary files in a temporary local pack. It supports the owner-only ruling without
a loopback host; the cached installer's `metadata:local` parser cannot consume raw private
metafiles. All other pinned artifacts also come from cache, so no internet download can occur.
The temporary pack is removed after installation; the installer manifest tracks the jars.
Dry runs (including from outside the checkout), a real full install and a repeat install
all pass. The repeat reports "Modpack is already up to date!" and all four private hashes
match. The first full install waited about 40 minutes for an unrelated GameTest JVM.
The cutover will reuse this route; this script deliberately refuses Stable and Local.

`walkthrough.md` in the evidence job is the one-screen coordinate checklist. Keep the bridge
until every chunk/player (including offline), colony and Dank store has been loaded and saved,
and pending `evileye_migration:smelter_items` / refunds lists drain. Dev.5 convert-all/status
commands are planned for cutover. Original/snapshot content and main/Stable/Local isolation
are rechecked for this job; no source, snapshot, Stable or Local was written or booted.

## Bridge dev.7 pin (2026-10-31)

`evileye_migration` is now 0.1.0-dev.7 (minecraft-mods 4c9fa1f, SHA-256
`5dbd229df52f5e081b93b7c77676d911771dd407cf9828876299e63a17b4cd9b`, 119,760 bytes); declared
dependencies unchanged. Jar stored hash-addressed and by filename in the shared migration cache and
in the Trial walkthrough's job cache (`jobs/2026-10-31-world-trial-final/cache`). Jade 15.10.3 restored
to the shared cache. Conversion evidence: `jobs/2026-10-31-world-trial-dev7/`.

## Phase 10 cutover tooling (2026-11-01)

Branch `migration/cutover-tooling`. **Nothing here has touched the real Stable instance**: only
`-DryRun` ran against it; the full cutover and rollback ran on a throwaway copy
(`jobs/2026-11-01-cutover-tooling/`, logs + manifests kept).

Scripts (all in `scripts/migration/`, owner-run standard: help, dry run, `.tmp/owner-runs/` log, OK/FAILED):
- `cutover.ps1` - **dry run unless `-Execute`**. Guards, then: archive, switch loader/Java, trial-route install.
- `rollback.ps1` - same convention; restores the newest (or `-Archive`) `cutover-archive-*`.
- `stable-prelaunch.ps1` - becomes Stable's PreLaunchCommand; repeats the verified private-jar install each launch.
- `cutover-lib.ps1` - guards/archive/restore functions (tested by `tools/packwiz/tests/cutover_guards.test.cjs`).
- `tools/packwiz/migration/cutover_install.cjs` - Stable target for the shared `installPack` in `trial_install.cjs`
  (Trial behaviour unchanged). `--fresh` first deletes every file the old install tracked in `packwiz.json`
  except files the new index marks `preserve`.

**Why `--fresh`**: the first rehearsal failed with `Installed artifact differs: config/addonslib-common.toml`.
packwiz skips a file whose pack hash equals its cached hash even when a Forge-era run changed it on disk,
and keeps tracked files the new pack dropped. Starting from an empty `mods/` plus untracked tracked files
gives the exact target inventory. Kubejs example/config files KubeJS generates itself remain (harmless).

Guards (real Stable): MultiMC and any Minecraft java closed; checkout `pack.toml` is NeoForge 21.1.265 / MC 1.21.1;
Stable is still Forge (refuses a second run); Java 21 exists; cache holds the `evileye_migration` bridge;
archive folder is new; free space >= 1.1 x archive + 2 GiB. A rehearsal `-Instance` copy skips only the launcher check.
Archive = whole instance folder except `logs`, `crash-reports`, `quickskin_cache`, `hs_err_pid*.log`, `packwiz-install.log`
(2.88 GiB / 3925 files for Stable), copied into `<ArchiveRoot>/cutover-archive-<date-time>/files` with `manifest.sha256`
(source and copy hashed and compared per file). Rollback re-verifies the archive first, then **moves** (never deletes)
the live NeoForge `.minecraft` to `cutover-rollback-<date-time>/` (a converted world is never downgraded in place),
restores from the archive and re-hashes every file.

### Owner's cutover day
1. Merge `migration/neoforge-1.21.1` to `main` (rehash per branch), qualify 100%, push.
2. Close MultiMC fully and the game. From the **main checkout** run
   `powershell -NoProfile -ExecutionPolicy Bypass -File <main checkout>scriptsmigrationcutover.ps1`
   (dry run; confirm `READY`), then the same with `-Execute`. About 6 minutes. Pass `-Cache <dir>` if the bridge
   or jars changed after `jobs/2026-10-31-world-trial-final/cache`.
3. Open MultiMC, launch **Evil Eye (Stable)** (the prelaunch reinstalls the verified pack), open the world, then as operator:
   `/evileye_migration convert-all dry-run`, then `/evileye_migration convert-all`, then
   `/evileye_migration status` until it reports SAFE TO REMOVE. Keep the bridge until then.
4. Rollback at any point: close the game, run `rollback.ps1` (dry run), then `rollback.ps1 -Execute`.
   The main checkout must stay put: Stable's prelaunch points at it.

### Rehearsal evidence (copy of Stable, 2026-11-01)
Run 1: archived, switched, install failed on the config above; `rollback.ps1 -Execute` restored 3925 files, every
hash matched, and an independent compare against pre-cutover hashes showed 0 differences. Run 2 (with `--fresh`):
cutover exit 0 in 6 min, 191 jars incl. `evileye_migration-...-dev.7`, mmc-pack = MC 1.21.1 + NeoForge 21.1.265,
Java 21 Temurin, prelaunch = stable-prelaunch.ps1, saves byte-identical to pre-cutover; rollback restored 3925 files,
0 differences. No game was launched. A launch of the cut-over copy has not been done; that is the owner's day-one check.
