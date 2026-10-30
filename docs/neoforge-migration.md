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

## Owned ports (deferred, never abandoned)

Seven mods had no NeoForge 1.21.1 build and are being ported by the owner in `minecraft-mods`:
Dank Recipe Transfer, Roundwood, Ars Instrumentum, Alex's Mobs, Alex's Caves, Ice and Fire, and
FlatWorldFix. FlatWorldFix is kept and ported, not swapped for Give Me My Flat World. The lock
records each one as `defer`. Phase 5 suspends their references, and each one returns as a direct
GitHub release pin (`repoint` to a `direct` target; restore steps in `tools/packwiz/migration/deferred/README.md`).

| Port | Pin | Integrated |
|---|---|---|
| Dank Recipe Transfer | 0.2.0 prerelease, `dank_recipe_transfer-1.21.1-neoforge-0.2.0.jar`, sha256 `3753e679…0275` | 2026-10-30 (parked nothing; malware guard clean) |

The other six are still `defer`.

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
- The recipe and tag events in `dedup.js` and `uranium.js` work: 25 recipes removed, survivor tags
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
