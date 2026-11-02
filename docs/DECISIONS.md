# Decisions

Newest first.

## 2026-11-02 - Cosmetic Armor Reworked is absorbed into Evil Eye Tweaks and Client (equipment panel wave)

**Decision.** Owner-approved plan 2026-11-01: Cosmetic Armor Reworked leaves the NeoForge pack. Evil Eye Tweaks 0.7.0 owns the cosmetic armour storage and the `evileye_tweaks:equipment` menu; Evil Eye Client 0.4.0 owns the equipment panel (Curios key G and the inventory button open one screen for curios, armour, cosmetic armour and cosmetic curios) and the cosmetic armour rendering; Evil Eye World Migration 0.1.0-dev.11 imports the old `playerdata/<uuid>.cosarmor` sidecars. **Why:** one equipment screen instead of two mods with separate screens and buttons, and fewer third-party jars (consolidation wave 7). **Rejected:** keeping Cosmetic Armor Reworked beside the Curios screen (two inventories to open, no shared visibility controls). Existing items are carried by the migration, not lost.

## 2026-11-01 - Tool tree regrouped; one install route and one instance-target authority

**Decision.** Push-review structure fixes (no behaviour change). `tools/` is grouped into `testing/` (client_mixin,
world_trial, server_smoke, pack_test, showcase) and `analysis/` (dedup, emi_curation, emi_coverage, mod_map,
malware_guard), with `packwiz`, `data_io` and `script-run` at the top. `server_smoke` splits into `process/` and
`runtime/`. The install route is neutral (`packwiz/install/install_pack.cjs`) with thin Trial and Stable targets;
`install/instance_targets.cjs` is the single place that knows which MultiMC instance is Stable, Local or Trial, and
`cutover-lib.ps1` asks it through a `classify` CLI. The no-symlink / containment / protected-output guard lives in
`data_io/path_guard.cjs`. **Why:** Stable's installer imported from a Trial-named module, the "never Local or Trial"
rule was written five times, and `tools/` had 13 siblings. **Rejected:** keeping the rule in PowerShell (the Node
installers need it too); a shared JSON of instance paths (two readers would still each encode the matching rules).

## 2026-11-02 - Classic raw silver textures from Ice and Fire's bundled legacy pack

**Decision.** `evil-eye-cozy-overrides` carries `iceandfire:textures/item/raw_silver.png` and `textures/block/raw_silver_block.png`,
byte-copied from `resourcepacks/iaf_legacy/` inside the pinned private `iceandfire-1.21.1-neoforge-2.1.4.jar` (Ice and Fire's own
optional legacy pack; Ice and Fire's authors own the art). **Why:** owner prefers the classic look. They apply with no model
change: the default `models/block/raw_silver_block.json` and `models/item/raw_silver.json` already point at
`iceandfire:block/raw_silver_block` and `iceandfire:item/raw_silver`, neither texture has an `.mcmeta`, and the folder pack sits above
the mod's assets. Personal family pack, never published, so redistribution licence is not a blocker. Re-copy from the jar if
its textures are ever re-pinned to a different version.

## 2026-11-02 - Slow Falling gets a drop threshold in Evil Eye Tweaks (0.6.1)

**Decision.** Everlasting Abilities' permanent Slow Falling stays, but Evil Eye Tweaks 0.6.1 makes the vanilla effect float
a player only after a fall of more than 3 blocks (`[movement] slowFallingMinDrop`), for every source of the effect. **Why:**
vanilla applies the 0.01 gravity from the first tick, so stairs and one-block step-downs floated; the fix belongs in the
owned mod as a narrow mixin on the effect checks, not in the ability or a datapack. Fall damage stays prevented. **Rejected:**
removing the ability (owner wants no fall damage); scoping the change to the ability only (the potion and Ars glyph feel the same).

## 2026-11-02 - Smooth thirst droplets ship from the pack override folder (Evil Eye Client 0.3.3)

**Decision.** Original 4x droplet sprites for `thirst:textures/gui/thirst_icons.png` and `appleskin_icons.png` live in
`resourcepacks/evil-eye-cozy-overrides`, not in Evil Eye Client's jar. **Why:** Thirst's own jar and ours would both
supply the `thirst:` path from mod resource packs, whose relative order is not defined; the override folder already
sits above CozyUI+ by explicit order (`config/evileye_client/resourcepacks.json`). Thirst draws its bar from
`thirst_icons.png` (8px-stride frames) and Evil Eye Client draws the rest from both files, all with absolute UVs against
the 25x9 / 256x256 logical size, so a 4x texture drops in. Generator: minecraft-mods `mods/EvilEyeClient/tools/textures/GenerateThirstSprites.java`.

## 2026-11-01 - The crafting-grid controls are removed (Evil Eye Client 0.3.2, Tweaks 0.6.0)

**Decision.** Owner ruling: the Crafting Tweaks replacement keys and server actions are unused, so they are removed from
both owned mods and the pack config. The owner fills recipes with EMI's "+" and Dank storage through DankRecipeTransfer,
neither of which depended on them. The hidden vanilla recipe-book button stays (cheap, independent; now
`[recipeBook] hideButton`). **Why:** less code, config and key-binding surface for controls nobody presses.
**Supersedes** the wave-3 crafting entries below on keys, right-click and server actions.

## 2026-11-01 - Wave 5: FTB Essentials becomes Evil Eye Essentials 0.1.0; FTB Library's sidebar moves to Evil Eye Client 0.3.0

**Decision.** FTB Essentials and FTB Library leave the NeoForge pack. Evil Eye Essentials provides the same
commands with the pack's values as defaults and imports `<world>/ftbessentials` once on server start
(checksum-keyed, backed up, never overwriting, all-or-nothing on a missing dimension or kit item). Evil Eye Client
rebuilds the inventory sidebar from vanilla commands plus `/trashcan`, gated by the command tree the server sends
each player. **Rejected:** keeping FTB Library for its sidebar alone (owner ruling: absorb small mods); a partial
import that skips unknown dimensions (data would be dropped silently); copying FTB's icons (All Rights Reserved).

## 2026-11-01 - Wave 3: screens, input and first-install defaults become Evil Eye Client 0.2.0

**Decision.** Better Advancements, Controlling, Default Options, Resource Pack Overrides, Just Enough
Professions, Mouse Tweaks and Crafting Tweaks are replaced by Evil Eye Client 0.2.0, with Crafting Tweaks'
grid actions performed by Evil Eye Tweaks 0.5.0 on the server; Searchables and Balm go with them after the
closure check. `config/defaultoptions/` keeps its location and syntax (the keymap tooling and docs read it);
the resource-pack policy moves to the pack-owned `config/evileye_client/resourcepacks.json` because the old
preserved file never delivered corrections, and its ids are fixed for NeoForge (Eat Quiet's file name, Town
Talk's `mod/towntalk:respack`). **Rejected:** keeping `key.craftingtweaks.*` names (a one-time import of saved
bindings keeps the owner's choices without impersonating the removed mod); porting Crafting Tweaks' on-screen
buttons and per-mod grid providers (the pack used HOTKEYS mode; AE2 terminals and other modded grids lose the
grid keys until a provider is written).

## 2026-11-01 - Wave 4: gameplay rules become Evil Eye Tweaks 0.4.0

**Decision.** AttributeFix, Companion, FallingTree, Flat Bedrock, Hourglass, Clumps and Let Me Despawn are
replaced by Evil Eye Tweaks 0.4.0 with the pack's effective settings; Bookshelf, Prickle, Almanac Lib and Kiwi
go with them after the closure check. Saved Clumps orbs and Let Me Despawn mob keys convert on load; day
length uses NeoForge's own day-time rate instead of Hourglass's per-tick packets. **Rejected:** keeping
Hourglass for its client-side smoothing (NeoForge clients already advance at the synced rate); keeping
Companion's game rules (at their defaults they change nothing).

## 2026-11-01 - Wave 2: presentation mods become Evil Eye Client

**Decision.** Yeetus Experimentus, Pick Up Notifier, Stylish Effects, Colorful Hearts, Enchantment
Descriptions and AppleSkin are replaced by the owned client-only Evil Eye Client 0.1.0, with server data
(backpack pick-up receipts, saturation/exhaustion) from Evil Eye Tweaks 0.3.0. Effective settings are carried
into `config/evileye_client-client.toml`; AppleSkin's texture path is kept so CozyUI+ still re-skins the food
sheet; coloured hearts derive from the active pack's (New Hearts) sprites. Bookshelf is kept because
AttributeFix requires it. **Rejected:** keeping AppleSkin for Thirst Was Taken's overlays (redrawn by the
client mod instead); dropping Bookshelf (would break AttributeFix).

## 2026-11-01 - Replace small mods with owned mods, wave by wave

**Decision.** Small gameplay/presentation/compat mods are replaced by three owned mods (EvilEyeTweaks,
EvilEyeClient, EvilEyeEssentials) in independently shippable waves ([mod-consolidation.md](mod-consolidation.md)).
Wave 1 pins EvilEyeTweaks 0.2.0 as a private `metadata:local` addition and drops Fuel Goes Here, Double
Doors and Collective (after a recursive closure scan). Effective upstream settings are carried into the
owned config; resource namespaces existing data uses (`fuelgoeshere:forced_fuels`) are kept.
**Rejected:** dropping the upstream mods without an owned replacement (loses used features), and one
catch-all owned mod (durable-data schemas must not ride in ordinary tweak releases).

## 2026-10-31 - Preserve game-owned client settings after first install

**Decision.** Index runtime-owned settings with packwiz `preserve = true`: shader option sidecars,
`*-client.toml`, and the explicit client/common files that the played Trial rewrote during its first
client runs, as classified by `pack_index.cjs`. The pack supplies their initial defaults, but later installs do not
overwrite the owner's or game's values. `options.txt`, Sodium and JEI outputs are already unshipped;
Default Options' shipped keybinding input remains installer-managed. The Trial post-install gate hashes
every non-preserve installed file, including every resolved mod jar and private local pin.

**Why.** Packwiz Installer writes a preserved file when absent and leaves an existing copy alone. A
hash assertion against the pack default after installation therefore contradicts installer semantics
and made a legitimate Iris shader-options rewrite block launch. Pack policy and executable artifacts
still need exact integrity checks; mutable preferences do not.

## 2026-10-31 - Accept Railways Controls warning as a known minor issue

- Accept Steam 'n' Rails' stale `client.MixinKeyBindsListKeyEntry` target as a known
  minor cosmetic issue for the NeoForge 1.21.1 owner trial. Railways keybinds may be
  shown as conflicting with one another on the Controls screen; this is not a crash risk.
- Keep the exception exact and separate from harmless optional/bootstrap findings:
  `tools/testing/client_mixin/allowlist.json` marks only that mod/config/mixin/target tuple with
  `"known-minor": "dk-2d33cee0"`. Any changed or additional finding still fails.
- Leave dk-2d33cee0 open and re-check it when a new Railways build is available.

## 2026-10-31 - Phase 9 acceptance and private delivery

- The owner accepts Polymorph SelectedRecipe reset as a transient preference reset,
  agreed with minecraft-mods. It is recorded, not classified as LOSS.
- For this gate the domain audits are authoritative. Raw full-comparison differences
  overlap fields and encodings; they are not counts of deleted objects. Remaining
  unqualified categories become owner walk-through checks, not Phase 9 blockers.
- The owner is currently the only player. Private Alex's Mobs, Alex's Caves, Ice and
  Fire and evileye_migration jars stay local on Valhalla; no public repository or
  download host. Prefer hash-verified direct copies if the installer can coexist;
  otherwise use the existing temporary loopback overlay and document why.
  The final Trial uses ordinary local pack files: packwiz copies and tracks the
  verified jars without a host. A real full install and repeat install both pass.

## 2026-10-30 - Evil Eye World Migration bridge

- Pin evileye_migration 0.1.0-dev.4 privately by SHA-256 and size, using the same
  local-source route as the Alex forks. Built from minecraft-mods bd5f1ce; no public URL.
- Require it in pack-test. The malware metadata gate validates its lock identity; the
  supplied jar scan has zero findings. Migration owns legacy mod-state conversions,
  including Curios, Dank links, Ender IO, Supplementaries, Ars and MineColonies.
- Keep the mod installed until every chunk, player (including offline players),
  colony and Dank store has been loaded and saved, and its pending lists
  (`evileye_migration:smelter_items` / refunds) are drained. Dev.5 convert-all/status
  commands are planned for cutover. Unvisited state converts on first load; one
  successful trial is not grounds to remove the bridge. Never convert the only
  copy or downgrade a converted save.

## 2026-10-30 - Ice and Fire CE and the final port follow-ups

- The owner designated CE dreadwood leaves and sapling unfinished creative-only content.
  `iceandfire-creative.json` hides both in CLEAN using the End Pirate item-list mechanism;
  ALL restores them. No survival recipes or permanent removals are introduced (dk-ce8a67fc).
- Ice and Fire CE 2.1.4 is a dev/trial local hash pin, alongside Alex's Caves r2. Uranus
  3.0-beta.1 and Jupiter 2.3.7 use normal CurseForge pins; all supplied hashes were checked.
- Ice and Fire silver survives: the existing world contains about 460,000 I&F silver ore blocks.
  Interstellaris silver ore/deepslate ore, raw silver, ingot, nugget and block retire at recipe,
  loot and tag sources, with permanent EMI removal. Its silver biome modifier is disabled.
  I&F worldgen and the restored explicit Large Ore Deposits silver/sapphire targets remain.
  Interstellaris silver dust, plate, wire and processing intermediates have no I&F duplicate
  and remain, consuming/producing the survivor. No inventory or placed-block conversion.
- `iceandfire:witherbone` again supplies `c:bones/wither`. BHC's Java bone drop rate is zero;
  its recipes use the I&F survivor. Removed Myrmex egg IDs are not restored.
- The twelve Alex's Mobs End Pirate/purpur blocks are creative-only by owner decision.
  `alexsmobs-creative.json` uses the same reversible CLEAN item-list mechanism as Roundwood;
  ALL restores them. Alex's Caves r2 owns both recipe tags, so the pack bridges are removed.

## 2026-10-30 - Private Alex ports and uranium progression

- Alex's Mobs 1.22.9 and Alex's Caves 2.0.2 are private forks. Commit only local-source pins
  (SHA-256 and size), never jars or download URLs. The migration cache supplies verified bytes by
  hash. A gitignored installer overlay serves them on loopback during dev/trial installation only;
  the installer rejects file URLs. Family delivery remains dk-85261627.
- Preserve the existing-world Alex's Caves radioactive uranium, shards, rods, block and radrock ore.
  They are progression materials (radiation and Tremorzilla), not another generic metal ingot.
  Restore their native block/shard/furnace recipes and the two raw-uranium-to-yellorium cooking
  recipes. Extreme Reactors raw yellorium remains accepted by the uranium and rod recipes.
- Keep Phase 7's Mekanism uranium replacement with Extreme Reactors yellorium and disabled uranium
  worldgen. Remove Alex's Caves shards from the metal-nugget tag and its radioactive raw block
  from the metal-storage-block tag; native recipes still use their exact item IDs. The raw uranium
  tag retains the documented biome/progression exception. No stack conversion or unifier.
- Alex's Caves sulfur dust is the existing-world survivor: retire Mekanism sulfur dust at recipe,
  loot and tag sources, preserving Mekanism machine outputs through generated overrides.
- Owner confirmed Mekanism steel remains the only steel; the Dark Steel stand-in stays retired.
- Owner confirmed Interstellaris' default disabled Mekanism teleporters. Drop dk-aef6fa66; no override.

## 2026-10-30 - NeoForge 1.21.1 migration: the Interstellaris stack joins with true dedup

- **Survivors are the items already in the owner's worlds.** Mekanism is new, so its copies retire:
  coal, copper, gold, iron, lapis, quartz and tin dusts go to Ender IO's `powdered_*`, obsidian dust to
  Create, diamond dust to Create Crafts & Additions' grit. Mekanism's own processing recipes are
  rewritten to output the survivors (dedup overrides), so its machines still work end to end.
- **Uranium is Extreme Reactors' yellorium**, as on main (`c:raw_materials/uranium` already meant
  yellorium). Mekanism's uranium ore, raw, raw block, ingot and block are replaced, and its uranium
  worldgen is off (`config/Mekanism/world.toml`). Its fission chain reads `c:` uranium tags, which hold
  yellorium. Mekanism's uranium dust and nugget stay: nothing else provides them.
- **Mekanism steel is the pack's one steel.** The 2026-10-23 Dark Steel stand-in only filled an empty
  `c:ingots/steel`; with real steel present it made Dark Steel and Mekanism steel interchangeable, which is
  the unification this pack rejects. Dark Steel is again only an Ender IO alloy. Consequence: Extreme
  Reactors' reinforced parts now need Mekanism steel. Rejected: keeping Dark Steel as steel (two steels in
  one tag) or rewriting Mekanism's steel to Dark Steel (Mekanism has steel dust, nuggets and blocks with no
  Dark Steel equivalents).
- **Create's crushed tin, lead and osmium are no longer hidden.** Mekanism's ores give them producers
  (Create's own compat crushing); Create's Mekanism-gated crushed-uranium smelting replaced `uranium.js`.
- **Large Ore Deposits stays off for osmium, tin and lead** for now: Mekanism generates them itself, and
  enabling deposits is a separate worldgen choice (dk-67a5b4cf).
- **Interstellaris' generic parts retire too**: iron and gold plates to Create's sheets, gold wire to Create
  Crafts & Additions', silicon to AE2's (as Ender IO's was). Its own metals (titanium, platinum, silver,
  tungsten, aluminium) have no other provider and stay. Silver is revisited when Ice and Fire returns
  (dk-d2c9d23b).
- **Interstellaris' own design is kept**: research-gated crafting and disabled Mekanism teleporters
  (owner confirmed; dk-aef6fa66 dropped). Its structure, Java-made and archaeology items are reasoned acquisition
  exclusions, not fixes.
- **Upstream data errors that only log are noise, not patches**, when a pack override cannot reach them:
  Sable's physics loader ignores `neoforge:conditions`, so Dragons Plus' entry for a block it registers only
  with Create Simulated stays a known-noise line.
- **1.20-layout data a 1.21 jar ships is restored or reasoned, never ignored** (`kubejs/data`, policy
  `ignoredLayout`); a fast-gate test checks every pinned jar so a new jar cannot silently lose content.

## 2026-10-30 - NeoForge 1.21.1 migration: first clean boot

- **Fix the evidence, then baseline only what is reviewed.** Seven ANU boots, one evidenced cause
  at a time (`docs/neoforge-migration.md`). Pack-side fixes come first: tag aliases, HammerLib `c:`
  config, the CEI data map, the Ender IO rule and the stone gear. Tooling learned the 1.21 data
  rules: ignored other-version folders, loot `value`, own load conditions, `transitional_item`.
  The rest of the findings are baselined one by one, with a reason tied to jar evidence. No crash,
  missing probe or broad migration category is baselined.
- **HammerLib's stone gear returns.** True dedup removes duplicates, and the stone gear has none on
  1.21.1. HammerMicroblocks saws need `#c:gears/stone`.
- **Configs ship the mods' own write-back**, as the Create 6 update did: no shipped value was reset, so
  adopting the 1.21.1 files keeps intent and stops every launch rewriting them.

## 2026-10-29 - NeoForge 1.21.1 migration: data tooling, activation, KubeJS 2101 and configs

Branch `migration/neoforge-1.21.1` (Phases 4–5). Status and open checks: `docs/neoforge-migration.md`.

- **One versioned data-layout recognizer** (`tools/data_io/resource_layout.cjs`). Evidence keeps the
  1.20 kind names, so checks and baselines stay comparable across versions. Rejected: a global
  `forge:` → `c:` rewrite. Tags are translated one by one and only where target data uses them
  (`tools/analysis/dedup/migration-1.21.json`).
- **The dedup generator owns its outputs** (`tools/analysis/dedup/generated.json`). Stale generated files are
  deleted on regeneration only when unmodified; hand-written overrides are never touched. The
  manifest was bootstrapped by byte-matching a Forge regeneration (96 owned files).
- **Pins frozen with minecraft-mods** (NeoForge 21.1.265, JEI 19.70.0.464, EMI 1.1.24, Polymorph
  1.2.0, Dank Storage 20), then the lock was applied by script. `migrate check` now verifies the
  applied state.
- **Deferred ports are parked, not deleted.** Their configs and data move to
  `tools/packwiz/migration/deferred/<port>/` at their original paths. Inert id lists stay in place.
  Temporary policy: `bhc:wither_bone` survives and BHC's drop rate returns to 0.15. Alex's Caves'
  uranium recipes are suspended while Create's stay.
- **KubeJS 2101 globals.** Only startup scripts may set `global` values, so `startup_scripts/globals.js`
  creates the namespaces and other scripts extend them. NeoForge listeners go through reloadable
  `NativeEvents` (`ui/native_hooks.js`), which drops the Forge-era once-per-launch flag. Item
  components are translated for the EMI curation only in `java_interop.js` (codec-encoded component
  patch). The EMI adapter boundary stays a deliberate tradeoff.
- **Configs:** a recorded treatment per file (`config-decisions.json`). Obsolete loader and renderer
  files are removed, and Oculus settings move to `iris.properties`. Everything else is carried
  unchanged and reconciled with generated target defaults at the first target boot, because no boot
  was allowed in this phase. Configs are never claimed migrated without that boot.

## 2026-10-29 - NeoForge 1.21.1 migration: isolation, lock and runtime-aware testing

Branch `migration/neoforge-1.21.1` only; `main`/Stable stay on Forge. Status and commands:
`docs/neoforge-migration.md`.

- **Separate trial instance with explicit Java 21.** A fresh `Evil Eye NeoForge Trial`
  (MultiMC components set in `mmc-pack.json`; packwiz never sets the loader), with portable
  Temurin 21 at `C:/Tools/evil-eye-pack/temurin-21`. Rejected: reusing Local (shares the
  main checkout's feed) and the machine-installed Microsoft JDK 21 (not checksum-verified, not
  ours to rely on).
- **A reviewed, hash-verified lock before any pack edit.** `tools/packwiz/migration/target-lock.json`
  records every source metafile exactly once with old identity, exact target file, publisher
  checks, sha1/sha256/sha512 and the jar's declared dependencies. It is generated from the survey
  plus `dispositions.json`, the reviewed decisions. Applying it is a separate step (Phase 5),
  refused if the source fingerprint changed. Rejected: re-pointing from `availability.csv` (no
  download identities or hashes) and hand-editing 180 metafiles.
- **Seven owned ports are `defer`, never replacements.** Dank Recipe Transfer, Roundwood, Ars
  Instrumentum, Alex's Mobs, Alex's Caves, Ice and Fire and FlatWorldFix. FlatWorldFix is kept
  and ported (owner, 2026-10-29) instead of swapped for Give Me My Flat World.
- **Dependency closure mirrors FML, including its leniency.** Maven ComparableVersion semantics,
  plus FancyModLoader 1.21.1's `VersionSupportMatrix`: on 1.21.1 a failing minecraft/neoforge range
  is retried with 1.21 / 21.0.166, so `[1.21,1.21.1)` mods load. No other leniency; exceptions
  need a recorded waiver.
- **Evidenced swaps and drops.** Radium Reforged is dropped because Create 6.0.10 declares it
  incompatible. Embeddium is dropped for Sodium, which Iris requires. MemoryLeakFix is dropped
  (ModernFix stays). Prickle, Lithostitched, Lionfish API and Sodium are added as declared
  required dependencies. JEI, EMI, Polymorph and Dank Storage stay provisional until minecraft-mods
  confirms what the ports build against.
- **One runtime identity keys everything.** `pack.toml [versions]` → `tools/testing/server_smoke/runtime/runtime.cjs`
  `id`. Loader bases, stages, world caches and ANU lanes are keyed by it and stamped with
  `runtime.json`; cross-runtime reuse is refused. World keys hash jar bytes and world-shaping
  config, not filenames. The Forge ANU lane keeps its paths, so `main`'s runs resync nothing.
  Rejected: one shared stage that is rebuilt on every loader switch (slow, and a half-built stage
  could still be booted).

## 2026-10-28 - Mod map measurement and tooling choices

Recorded at the mod map's structure review, for choices made while building it.

- **Own `mods.toml` reader, scoped to that file.** Now `tools/data_io/mod_metadata.cjs`
  (moved 2026-10-29 for the NeoForge migration, which shares it; it also reads
  `neoforge.mods.toml` and NeoForge dependency `type`). Originally it read only Forge `META-INF/mods.toml` scalars (quoted strings, comments,
  multiline descriptions, `[[dependencies.<id>]]` tables). The repo stays
  dependency-free, and `mods.toml` is written by hundreds of authors, unlike the
  packwiz-written metafiles. Packwiz `.pw.toml` files are read only through
  `packwiz/pack_index.cjs` `readTable` (now including `readMetafileSide`).
  Rejected: a general TOML package (a dependency for one shape) and stretching
  `readTable` to multiline/single-quoted strings (it is deliberately strict).
- **Per-mod timing from FML TRACE through a custom log4j config.** Forge DEBUG
  has no paired per-mod durations; the `FMLModContainer` TRACE pairs do (see
  [Gotchas](GOTCHAS.md#mod-map-timing)). Only the disposable capture server gets
  `mod-map-log4j.xml`, which routes that one logger to its own file. Rejected:
  global TRACE (log volume and overhead), Java agents or profilers (a new runtime
  dependency, and they measure CPU, not the load phases the owner removes mods for).
- **Reuse a cached world with different provenance.** When no world exists for
  the exact mod set and seed, `-World` copies an older cached world into the
  disposable server and records its different mod-set origin. It avoids paying
  fresh spawn generation inside the measured window; the missing-mod warnings it
  can cause are kept visible. It is never modified in place, and without it the
  run fails before Java starts.
- **Vendored script templates.** `scripts/owner/owner-run.ps1` (owner-run 1.0.0)
  and `tools/script-run/script-run.mjs` (script-run 1.1.0) are verbatim copies
  of `~/.claude/templates/scripts/`, so the repo works on any checkout without the
  harness. They are updated by re-copying the template, never edited locally.

## 2026-10-28 - Pack trim: remove twelve unused mods

The owner went through the mod list to cut load time and picked these for
removal: Common Capabilities 2.9.11; the RFTools family (Base 5.0.7, Builder
6.0.10, Control 7.0.4, Dimensions 11.0.11, Utility 6.0.7) and McJtyLib 8.0.8;
Iron Furnaces 4.1.8; Chunky 1.3.146; Charging Gadgets 1.11.0; Tesseract 1.0.38
and SuperMartijn642's Config Lib 1.1.8, which only Tesseract required.
SuperMartijn642's Core Lib stays: Additional Lanterns and Connected Glass need it.

Why: load time (about 2.4 s for RFTools, 0.46 s for Tesseract, 0.24 s for Iron
Furnaces, the rest under 0.1 s each) and the owner's choice. The 2026-10-28 scan
of every jar in Evil Eye Local found no other mod declaring any of them as a
dependency. Their configs (including the ten Advanced Chimneys `ironfurnaces$*`
emitters), the Jade Tesseract plugin entries, their dedup hidden-only entries
and hidden reasons, the EMI curation creative screen and syringe rule, and their
pack-test baseline findings are removed. The pack test now lists all twelve mod
ids in `removedMods`, so a shipped reference to any of them is reported.

Consequence for existing worlds: placed RFTools machines, iron furnaces,
chargers and tesseracts disappear with their contents; back up and empty them
first. The Stable world's `data/RFToolsDimensions.dat` becomes inert (it has no
RFTools dimension folders). Chunks Chunky already generated stay.

Kept after checking: Polymorph (it resolves 770 recipe conflicts), the Hammer
mods (HammerMicroblocks calls HammerMultipart directly) and Entity Culling /
3D Skin Layers (TRansition and TRender are bundled inside them).

## 2026-10-27 - Remove Enhanced Celestials and lengthen days

Remove Enhanced Celestials 5.0.3.2 and its now-orphaned mandatory dependencies
Data Anchor 1.0.0.23 and CorgiLib 4.0.3.5. Remove CorgiKubeJSCompat 1.0.1 too:
it existed only to initialize CorgiLib before KubeJS registry enumeration.
Inspection of every installed jar's `META-INF/mods.toml` found that only
Enhanced Celestials and CorgiKubeJSCompat depended on CorgiLib, and nothing
depended on CorgiKubeJSCompat. Their configs and all pack references are removed.

Add Hourglass 1.2.1.1 for Forge 1.20/1.20.1 on both client and server, pinned to
Modrinth version `G7VDa3zX` with SHA-512. It is dependency-free and controls day
and night independently. The per-world default sets `daySpeed = 0.5` and
`nightSpeed = 1.0`, making daylight roughly twice as long as night while leaving
night at vanilla speed. `enableSleepFeature = false` keeps vanilla bed and
night-skip behavior instead of Hourglass's optional smooth time acceleration.

Hourglass server settings live in `<world>/serverconfig/hourglass-server.toml`;
Forge copies `defaultconfigs/hourglass-server.toml` only when creating a world.
Existing worlds need that file copied into their `serverconfig` directory while
stopped. The pack test requires `hourglass` in the live mod registry and rejects
all four retired mod ids. A spatial `/evileye showcase` section is not used: time
speed has no bounded build fixture or client-rendering surface.

## 2026-10-25 - Roundwood 0.13.3

Add the owner's [Roundwood release](https://github.com/dirtyredz/Roundwood/releases/tag/v0.13.3)
on both sides, pinned by direct URL and SHA-256 in `mods/roundwood.pw.toml`, without
an update section. The downloaded jar matched
`150874f1a48c88c8af0995cb33aa2970cdfb83dc828cd0b049a8b635f7f206e4`.
Its required Minecraft `[1.20.1,1.20.2)` and Forge `[47,48)` ranges accept the pack;
optional client EMI `[1.1,)` and JEI `[15,)` accept 1.1.24 and 15.62.0.219.
No additional dependency is needed. Isolated content scanning and the metadata
gate returned zero findings, with no approvals added. Evidence lives in
`jobs/2026-10-25-add-roundwood` under the documented artifacts root.

Use Roundwood's own player-only `/roundwood showcase`, not a duplicate pack
section. Its destructive display volume is described in [showcases](showcases.md#roundwood-native-showcase).

Headless acceptance built all 13 native sections and both archways; saved-world
NBT confirmed the Cross Beam at `(420,240,18)` with display origin `(400,240,0)`.
All 525 contraption-storage assertions passed in the same boot. Warning/error
groups matched the prior storage run whose indexed pack exactly matches `main`
at `ace7be9`. Two boots were needed because the first probe used an unmapped
fake-player rotation setter. The second probe's legacy `_cross` block-ID check
was corrected by inspecting persisted `WindowCrossBeams` NBT, without another
boot; original failed probe reports are retained alongside `acceptance.json`.
Client appearance remains an owner check.

## 2026-10-25 - Shared showcase plans and one-boot section checks

**Amended 2026-10-25:** the builder makes its own plot instead of requiring flat,
empty ground: it clears the box (flags 50), discards ordinary entities and refuses
only for real impossibilities or protected entities (player, tamed, named). This
mirrors Roundwood's builder; the felt target is "type it where you stand and it
appears". Rejected: keeping flatness/occupancy refusals (made the owner hunt for
ground and herd mobs); rotating the plot to the player's facing (Create
contraption and sign coordinates are absolute); the original rationale below
("without accepting arbitrary occupied terrain") is superseded.

Use a pure bounded-plan registry, one world-writer builder and one command tree,
with one self-registering file per section. Signs sit two cells east of samples
and face the north entrance, following the owner's mod showcases. Persistent
reservations permit deliberate idempotent rebuild/clear without accepting
arbitrary occupied terrain. Rebuild resets contents; clear retains a flat floor.

Headless checks use the production command and matching section modules in one
injected harness and server boot. Reuse server-smoke supervision and pack-test
copying/evidence code. Offline staging validates current pins against cached
files and never downloads. This promotes scratch-probe behaviour to committed
checks while separating client-only claims. See [showcases](showcases.md).

## 2026-10-25 - Storage Drawers unsided capability fix

Pin [Storage Drawers 1.20.1-12.15.1](https://modrinth.com/mod/storagedrawers/version/53npfO5m)
(Forge, Modrinth `53npfO5m`). Its upstream
fix restores the unsided storage interface required by Create: Storage Drawers
Compat 1.1.0. The prior 12.15.0 real-contraption probe exposed zero mounted slots
for all three drawer types despite working placed sided handlers.

The new jar passed content scanning, the source/known-bad metadata gate and live
Modrinth status, with no findings or approvals. A disposable headless bearing/PSI
probe verified standard, two-slot and compacting drawers, including prefilled
contents, conversion and restoration; placed drawers expose all six sided and
the unsided handlers. Iron Chest passes as the positive control; stone has zero
mounted slots, rejects all items and restores unchanged. Evidence and the
uncommitted harness live in the `2026-10-25-sd-12-15-1` job artifacts. No client
rendering, drill/harvester collection or mounted GUI claim is made.

## 2026-10-25 - Create contraption storage

Create: Compatible Storage 2.14.0 (Modrinth `Sk6HcFCU`) adds Iron Chests mounted
storage for Create 6.0.8. Create: Storage Drawers Compat 1.1.0 by Jurami_
(CurseForge project 1626460, file 8647031) supplies drawer mounted storage,
including item transfer, NBT restoration, compacting drawers and manual access.
Both are installed on client and server. Their declared ranges accept Forge
47.4.10, Create 6.0.8 and Storage Drawers 12.15.1; the drawer author tested
12.14.3. No separate dependency is added. Compatible Storage bundles MixinExtras
0.5.0 and accepts the existing optional Moonlight 2.16.37.

Sources: [Compatible Storage](https://modrinth.com/mod/create-compatible-storage/version/Sk6HcFCU)
and [Storage Drawers Compat](https://www.curseforge.com/minecraft/mc-mods/create-storage-drawers-compat/files/8647031).
The similarly named Modrinth drawer mod is by a different author.

Both jars passed the malware content scan and source/known-bad gate. The drawer
jar was decompiled with checksum-verified Vineflower 1.12.0 and reviewed before
commit: storage/menu/rendering code, no external network, direct filesystem,
process execution, reflection, dynamic class loading or native code. Detailed
evidence lives in the `2026-10-25-contraption-storage-compat` job artifacts.

Verification: one isolated local pack-test boot passed (Done in 133 seconds,
probe complete, clean shutdown), with no new findings or normalized warning/error
messages against clean main `acfd50f`. That initial boot did not exercise PSI
transfers; the later 12.15.1 probe above does. Drill/harvester collection and client
rendering still need in-game verification.

## 2026-10-24 — Core malware guard with exact, reviewed hash exceptions

**Decision.** Add three offline layers under `tools/analysis/malware_guard/`: recursive
static content scanning, installed-file drift, and a pinned-source/known-bad
metadata gate. Save their evidence during pack-test staging and report new matches
through the ordinary verdict. Optional Modrinth version/project status lives in a
separate cached subcommand, never in an offline boot. Use the shared Node ZIP,
jar traversal, JSON and SHA-256 readers; do not execute inspected classes.

**Why.** The owner selected the core scope after the 2026-10-24 report of 34
malicious projects. No listed project matches this pack's metadata. Exact archive
hash plus finding approvals preserve useful signals without trusting a filename,
library name or future version. Folder packs are installed file by file; approving
the folder wholesale would hide added payloads. Owner additions have a separate
hash registry and still receive the static scan. Named finding/owner approval
kinds share one identity function and report application. Pre-boot evidence is
collected raw by `pack_test/session/security.cjs`, with explicit scan/drift/gate
report kinds. Approvals apply once at the CLI or offline analysis boundary, never
in detection. Analysis accepts legacy evidence using its named report slots and
discards saved approvals before applying current policy.
Signature patterns are validated data; heuristics retain limits and toggles.

**Evidence and tradeoffs.** Stable's initial scan found 12 matches: three loader
heuristic false positives in Guava/Reflect, four WebP natives, one targetless
Stylecolonies shortcut and four benign signature matches in CPM, HammerLib and
Supplementaries. Local bytecode/header inspection justified all twelve narrow
approvals, each with its own reason and named reviewer. Six local drift hashes
cover Pixlli, two older Complementary shader packs and their settings, and Windows
folder metadata. These are observations of these bytes, not publisher trust.

**Limits.** String scanning does not detect every obfuscation or prove a network
download feeds a class loader. Limits and malformed inputs produce incomplete
results. Online status has fake-HTTP coverage; a live call was not authorised.
The seed report was supplied by the owner, not fetched; no project IDs or hashes
were invented. No antivirus service, download, remediation or quarantine is added.

## 2026-10-24 — EMI toolbar ownership and shared Node data I/O

**Decision.** `ui/placement.js` owns the toolbar rect registry and the CLEAN, Mods and DECOR widget names. Widgets publish live visible rectangles; siblings consume geometry without reading each other's widget state. Unknown names log once per script load. `recipe_view.js` owns `recipeState` and the recipe-wrapper lifecycle; the existing migration shim remains for reload compatibility.

Node tools share `tools/data_io/`: `zip_reader.cjs` reads ZIP entries, `walk.cjs` traverses jars with caller-selected entries and optional nesting, and `files.cjs` reads strict JSON and hashes bytes with SHA-256. Coverage, dedup and pack-test depend on this folder; ANU code sync includes it.

**Why.** Geometry and recipe-wrapper state belong with the components that manage them. A neutral data I/O folder removes the jar walk's dependency on the coverage CLI and consolidates the thin file-data and jar-data folders. Traversal policy, non-SHA-256 jar hashes and in-game button behavior remain unchanged.

## 2026-10-24 — Dedup data ownership and acquisition exclusion registry

**Decision.**
- Block-tag policy is data, not a namespace-prefix rule. The catalog identifies blocks by pinned jar block loot-table paths; `plan()` filters replacement ids against that set. This reproduces the reviewed 26 removals. `kubejs/config/dedup.json` stays authored-only; generated `blockTagRemovals` belongs in `dedup_sources.json`, with an empty-list guard in the server script. Loot-table evidence is sufficient for the current replacements, not a complete runtime block registry.
- Hand-written server recipes belong in a script named for their concern. `uranium.js` owns the four Alex's Caves / Create crushed-uranium → yellorium recipes; `dedup.js` only applies duplicate cleanup.
- `tools/analysis/dedup/hidden_reasons.json` is the acquisition exclusion source for `hiddenOnly` ids. `tools/testing/pack_test/data/policy.json` must not repeat them. Tool-data loading reads the registry and passes it explicitly into the pure policy compiler. Re-analysis uses the current registry with saved pack evidence, so corrected reasons apply to historical runs.

**Alternative rejected.** Hard-coded namespace prefixes duplicate block classification in code and tests and miss blocks from other namespaces.

## 2026-10-23 — Acquisition baseline reviewed item by item (dk-e4cc1e7b)

**Decision.** The 439 `acquisition/no-known-source` entries accepted in bulk were each classified from the mod jar (classes, lang, data). The full table (item, class, mechanism and evidence, action) is `classification.md` in the job folder `artifacts/evil-eye-pack/jobs/2026-10-23-acquisition-review/`.
- **Kept in the baseline (307)** with a per-item reason naming the mechanism: made in Java with no recipe (special-recipe serializers, machine/block-entity output, in-world interactions, rituals, NBT or filled variants, tablets, packages, paint pitchers, presents; 226) or a mob drop, villager/colonist trade, boss or structure loot, loot modifier (81). Policy: a baseline entry says what produces the item, never just "mod code"; a mechanism that could not be confirmed says so in the reason.
- **Hidden (131)** through `dedup.json` `hiddenOnly` (regenerated EMI index): creative-only, icon, render-state and placed-only technical items (106, plus six placed-only encased Create blocks) and items with no source in this pack (18, plus `dankstorage:red_print`, whose jar ships no recipe). Hiding removes them from EMI only. To un-hide an item, remove it from `hiddenOnly` and regenerate.
- **Fixed (1):** `supplementaries:bomb_spiky` was craftable only with lead ingots (or Oreganized), neither in the pack; `kubejs/data/supplementaries/recipes/spiky_bomb_2.json` overrides it with iron ingots (the Oreganized variant's own ingredient).
- **Productive Bees bee types.** `bee_conversion` `result` and `bee_breeding` `offspring` are bee type ids (data-driven NBT on one configurable bee entity), not items. The pack test now recognises them (`tools/testing/pack_test/checks/bees.cjs`), no longer reports `output-unrecognized` for them, and counts the configurable spawn egg as their product for acquisition evidence.

## 2026-10-23 — First pack-test findings: fixed, allowed or hidden (orchestrator rulings, owner away)

**Decision.**
- **Ars Elemental quartz crush.** `ars_elemental:quartz_crush` output the nonexistent `minecraft:nether_quartz`; `kubejs/data/ars_elemental/recipes/quartz_crush.json` overrides it with `minecraft:quartz` (same counts and chances).
- **Allowed duplicate groups** (`tools/analysis/dedup/allowed_groups.json`, `liveOnly`): `alexscaves:galena_iron_ore` in `#forge:ores/iron` (a stone-variant iron ore, same material) and `supplementaries:ash_brick` in `#forge:ingots/brick` (a distinct material Supplementaries deliberately tags as a brick). Both reach the tag through Forge's own tags, which the cached-jar test cannot see, so the cached-jar stale check skips `liveOnly` entries and only the live pack test guards them.
- **Removed from a tag.** `cluttered:chiseled_gold_block` is a decor block and must not act as gold storage: `dedup.json` `tagRemovals` (`forge:storage_blocks/gold`) is applied by `kubejs/server_scripts/dedup.js` (`event.remove`) and subtracted in the cached-jar duplicate test.
- **Hidden orphans.** Nineteen items players could see in EMI but never obtain went into `dedup.json` `hiddenOnly` (regenerated `kubejs/assets/emi/index/stacks/dedup.json`): nine Extreme Reactors dusts, `reinforced_reactorfluidport_mekanism_passive`, `enderio:powdered_cobalt`/`powdered_tin`, three Iron Furnaces allthemodium/unobtainium/vibranium upgrades, and four Create items (`chromatic_compound`, `refined_radiance`, `shadow_steel`, `crushed_raw_quicksilver`). Checked in the evidence: the only producers are Thermal pulverizer recipes, Mekanism-gated recipes, `allthemodium`-gated recipes and quicksilver-tag-gated Create crushing, all of which are unloaded because those mods or tags are absent; no loot or worldgen source. The pack test already treats `hiddenOnly` as an expected acquisition exclusion.
- **Create: Dragons Plus sandpaper polishing recipes are static data (2026-10-23).** The mod generates them racily (see GOTCHAS), so boots lost up to 85 of 269 recipes. The three generators are off in `config/create_dragons_plus-common.toml` and the recipes ship in `kubejs/data/create_dragons_plus/recipes/sandpaper_polishing/` under the original ids; `machines.json` no longer marks the type `varies`.
- **KubeJS construction race** is diagnosed, not fixed: see Docket `dk-e9c3d82d` and GOTCHAS.

## 2026-10-23 — Automated pack test: one headless boot, an artifact-only KubeJS probe, exact baselines, ANU by default

**Decision.** `node tools/testing/pack_test/run.cjs` is the agent's acceptance command for pack changes. It boots the checkout once on a hidden Forge dedicated server (no client, no window), and a KubeJS probe in that throwaway server writes the live registries, final tags, every loaded recipe and the results of five scripted crafts. Node then checks recipes, tag/loot/removed-mod references, acquisition coverage, machine recipe types, crafts, the duplicate-material guard on live tags, and log groups, and compares every finding with `tools/testing/pack_test/data/baseline.json`.
- **Probe = KubeJS server scripts copied into the throwaway server only** (`tools/testing/pack_test/probe/`, unshipped). KubeJS already ships, earlier artifact probes worked, and it reaches the live `RecipeManager`, registries and a `FakePlayer` crafting menu. A Forge test mod would add a build and distribution step for no extra reach.
- **Raw data is read by Node, not the probe.** KubeJS's class filter denies `java.io`, so resource streams cannot be read from a script; Node reads the same installed jars (vanilla, Forge, mods, KubeJS data) for conditions, loot references, tag files and worldgen blocks. Precedence is approximated (KubeJS > mods > Forge > vanilla); the log and live state stay authoritative.
- **One boot.** The supervisor waits for `Done` *and* the probe's manifest (run token checked); it never boots twice. Spawn-area generation is the slowest part of a boot and is irrelevant to recipes, so a generated world is cached per mod set and seed (`--fresh-world` regenerates).
- **Exact baselines.** Findings have a stable key (check, code, subject, reference); only `fail` findings can be new; each baseline entry carries a reason. A run writes `baseline-candidate.json` for review and never updates the committed baseline itself. Exit 0 = no new findings, 1 = new findings, 2 = invalid run (incomplete probe, crash, setup or cleanup failure), which a baseline can never absorb.
- **ANU by default.** The run executes on ANU (the LAN test PC) so Valhalla stays free; `--local` runs here, and an unreachable or busy ANU falls back to Valhalla with the reason in the summary. Valhalla stages the pack (incremental `-s server` install), syncs only changed files, starts a detached agent (`Win32_Process.Create`, BelowNormal), and analyses the pulled-back evidence itself, so local and remote verdicts come from the same code.

**Limits.** Server-side only: no EMI rendering or search, textures, keybindings, client mixins or multiplayer sync. Acquisition evidence covers recipes, loot tables, worldgen block drops and block-drop chains; trades, Java-coded drops and in-world conversions (waxing, stripping, bucketing) are invisible, so those items need reasoned policy exclusions or baseline entries. Ingredient checks rely on Forge's ingredient JSON plus the live match count; custom ingredient predicates are only checked for "matches nothing".

## 2026-10-23 — Audit 2 fixes: Dark Steel is the pack's steel, keymap clashes resolved

**Decision.**
- **Steel.** With AllTheOres gone, `forge:ingots/steel` was empty, so Extreme Reactors' 17 `forge:conditional` recipes fell back to their `_alt` versions (iron blocks) and its manual showed 14 missing-recipe pages. `kubejs/config/dedup.json` `extraItemTags` now adds `enderio:dark_steel_ingot` to `forge:ingots/steel` (regenerated into `dedup_sources.json`). ER only reads the ingot tag, so plates, nuggets and blocks are not tagged (the Productive Bees steel comb reads `nuggets/steel` and stays off). This fills an empty tag with one namespace, so the duplicate-material guard needs no exception in `allowed_groups.json`; `pack.test.cjs` pins the entry instead.
- **Willow door.** Cluttered's jar tags `cluttered:willow_door` as a trapdoor; the replacement inherited it. `dedup.json` `tagFixes` (applied in `tools/analysis/dedup/overrides.cjs`) maps it to `biomesoplenty:willow_trapdoor` in `minecraft:trapdoors` and `minecraft:wooden_trapdoors`, so regeneration keeps the fix.
- Removed `config/simplecorelib-common.toml` (SimpleCore API left on 10-21). `builtin/towntalk` (MineColonies citizen voice lines) joins `default_packs`, before the overrides folder.
- **Keymap.** Every in-world clash from the audit is gone. Kept: Ars book I, Chloride zoom Z, Tool Belt R (Tool Belt removed 2026-11-01; R is free in world), Xaero U, GuideME G, Building Gadgets anchor H, Iris O, Xaero minimap settings Y and settings ], vanilla keys. Moved: Dank Storage construction/pickup to keypad 7/6, AstikorCarts slow/action to right Ctrl/right Alt, Create Jetpack active/hover to 0/Caps Lock, Customizable Player Models gestures to F6. Unbound: MCA skin library, Ender IO probe mode, RFTools next destination, Modern UI zoom (Chloride is the single zoom; Modern UI's would also clash with vanilla's creative hotbar save on C).

**Limits.** Context-limited shares stay (dragon riding R/X, JEI/Ponder GUI keys). Default Options applies only to instances with no saved value, so existing instances need these `key_...` lines removed from `options.txt` (or a manual rebind). Caps Lock and the right modifier keys are unusual bindings chosen because every letter, digit and numpad key was taken.

## 2026-10-23 — Config polish pass: default keymap, Cozy look by default, Crafting Tweaks hotkeys

**Decision.**
- **Default Options** (BlayTheNinth, 18.0.5, client side) ships `config/defaultoptions/keybindings.txt`, a conflict-free default keymap for every mod key that collided in the owner's `options.txt` (C, V, R, K, X, Z, U, M, F7, G). Lines use options.txt syntax (`key_<mapping>:<key>[:<modifier>]`). Vanilla keys, plain movement and inventory stay untouched; the vanilla creative toolbar C/X, the Iris/Create/Railways context keys and the dragon-riding keys (R, X) keep their defaults.
- `config/resourcepackoverrides.json` gets `default_packs` for the Cozy set, in the order the owner tested in the Cozy trial (Fresh Animations, Eat Quiet, Fancy Crops, Better Leaves, New Hearts, CozyUI+, then the `evil-eye-cozy-overrides` folder on top). New Hearts declares pack_format 2, so it gets `force_compatible`. Eat Quiet stays `required`.
- Crafting Tweaks `mode = "HOTKEYS"`: its grid buttons are gone, IPN already sorts (middle mouse) and shows only its move-all button.

**Why / limits.** Packwiz cannot manage `options.txt`. Both Default Options keys and Resource Pack Overrides defaults apply only where the player has no saved value, so existing instances (Stable, Local) need a one-time manual rebind and pack selection. Pixlli (the owner's own 128x pack, not pack-managed) is deliberately left alone: it is not forced off, and fresh instances do not get it. No button overlap between IPN, Curios and Cosmetic Armor could be shown from configs alone (Curios `TOP_LEFT` with 0 offsets, Cosmetic Armor button at 65,67, IPN's sort buttons hidden), so those were not moved.

## 2026-10-23 ? Abandon migration and remove duplicate providers

The owner tested release 1 locally: auto-swap only converted some items. The owner chose outright removal of AllTheOres, AllTheCompressed and Almost Unified, accepting loss of every remaining stack and placed/unmined block. The two-release plan below is superseded; neither release-1 commit had been pushed. No conversion, swap or registry remap is shipped.

Large Ore Deposits keeps its explicit survivors and disabled dead-end deposits. Remaining duplicates use config switches first, then recipe/loot overrides and tag cleanup, with permanent EMI hiding. Ender IO owns iron gears; HammerLib gears are disabled (release 1 incorrectly targeted its copper/gold/diamond gears). [The survivor table](duplicate-cleanup.md) records exceptions and compatibility limits. The cached-jar Node guard rejects new multi-namespace material groups, with narrow documented exceptions.

## 2026-10-22 — Two-release retirement of AllTheOres and AllTheCompressed

**Decision.** Keep AllTheOres, AllTheCompressed and Almost Unified installed in release 1. Stop all new AllTheOres generation, redirect surviving ore drops, and provide literal one-to-one material conversion recipes. Keep retiring items visible so players can find migration recipes. Almost Unified keeps running with survivor priorities and exclusions for the conversion recipes.

**World consequence.** Release 2 removes the mods and the temporary scripts/data. Unconverted stacks and placed/unmined AllTheOres blocks disappear; the owner accepted the loss, so no registry-remap mod is built. The former migration note (now [duplicate cleanup](duplicate-cleanup.md)) enumerated items without a survivor and recorded the compressed-block limitation: there is no other compressed provider, so native 9:1 unpacking preserves material before the base-item conversions. The other seams and duplicates in the audit are separate work.

## 2026-10-21 — Fusion is SuperMartijn642's connected-textures library, not Alexndr's alloy add-on

**Decision.**
- `mods/fusion.pw.toml` pins SuperMartijn642's Fusion 1.2.12 (Modrinth direct URL, sha512). The previous Alexndr/Sinhika "SimpleOres: Fusion" 6.0.0.3, its only dependency SimpleCore API, and `config/fusion-common.toml` are removed. The two mods share mod id `fusion` and cannot coexist.
- 1.2.12 rather than 1.3.16: Connected Glass 1.1.14 references Fusion API classes that 1.3.x no longer has.

**Why.** Connected Glass (and Ender IO glass) need the `fusion:model` loader; the old jar logged 425 "Model loader 'fusion:model' not found" errors. Nothing in the pack (recipes, KubeJS, configs, other jars) referenced the alloy add-on; its only trace was a chest-loot toggle added to suppress its duplicate bronze/steel. Consequence: items such as `fusion:bronze_*`/`steel_*` in existing worlds become unidentified.

## 2026-10-21 — Local decor marks, set in game

**Decision.** A rebindable key (default D, "EMI Curation" controls category, GUI conflict context) cycles the hovered item's local override automatic -> decor -> not decor; Shift does the same for its mod. Marks persist in `config/emi-curation/decor-local.json`, which is not in the pack index and layers above `decor.json` (item marks, then mod marks, then the shipped layers). A malformed file is ignored and never overwritten.

**Why.** Curating decor from a config file means leaving the game and guessing ids; the owner sees the item in front of them. Keeping the marks out of the pack means a packwiz update cannot erase them; folding them into `decor.json` later is an explicit ask.

**Rejected.** Writing to `decor.json` directly (the index would change and the next sync would overwrite it); EMI's own hidden-stack store (that is the user-hide feature and would hide recipes too); a chat command (slower than a key over the item).

## 2026-10-21 — Auto Mods menu and an independent DECOR toggle

**Decision.**
- The Mods menu lists every loaded mod that owns an item in EMI's current index, A-Z by display name. `mods.json` is now only overrides (rename, hide, pin). A dropdown too long for the window is paged, not squeezed.
- DECOR is a second axis beside CLEAN/ALL, not a third CLEAN mode. It removes decor stacks from the index copy only; recipe displays, uses and lookups are never filtered by it. The rules live in `config/emi-curation/decor.json` in three layers (manual exceptions, whole mods, tags).
- It starts SHOWN (`defaultHidden: false`), so the out-of-the-box index and ALL are unchanged. The owner flips the default in `decor.json`.
- Doors and trapdoors are not decor (access and redstone parts); beds and signs are. Joy of Painting is not a decor mod, only its easel and canvases are.

**Why.** A hand-written list always misses newly added mods. With decor as a second axis, ALL still means EMI's ordinary index when DECOR is shown, and decor can be hidden under either CLEAN mode. Keeping recipes intact avoids hiding crafting steps that merely use a decor block.

**Rejected.** A third "CLEAN + no decor" mode (not independent); hiding decor in recipe displays (breaks recipe lookups); a hand-listed decor item set (stale on every mod add).

## 2026-10-20 — Dank Recipe Transfer: owner's standalone mod, hosted as a GitHub release

**Decision.**
- Moving recipe ingredients out of Dank Storage into a crafting grid (JEI/EMI "+" button) is a custom mod, **Dank Recipe Transfer 0.1.0**, not a fork or patch of Sophisticated JEI Index. It is a standalone mod so it follows Dank Storage and the viewers independently and can be rebuilt without touching a third-party jar.
- Custom mods live in the `minecraft-mods` workspace (`C:/Users/dirty/projects/minecraft-mods/mods/DankRecipeTransfer`, repo `dirtyredz/dank-recipe-transfer`) and are published as GitHub releases. The pack installs the release jar through `mods/dank-recipe-transfer.pw.toml`, a direct-URL metafile with a sha256 hash (no `[update]` section), `side = "both"`.

**Why.** The jar must be reachable by the packwiz installer from a public URL; a release asset with a pinned hash is the same trust model as the Modrinth direct-URL metafiles already in the pack.

## 2026-10-18 — Server compatibility smoke is the agent's check; Oculus is client-only

**Decision.**
- `tools/testing/server_smoke/smoke.cjs` (headless Forge 47.4.10 dedicated server, `-s server` install) is how agents verify pack compatibility. The owner verifies the client by hand.
- `tools/testing/server_smoke/known_noise.json` is an allowlist of observed, harmless boot errors. Any error group not in it fails the run, so a new mod's breakage cannot hide as noise; add an entry (with the reason) only after reading the log.
- Oculus is `side = client`: it loads client classes at construction and crashed the dedicated server (`Attempted to load class ...Screen for invalid dist DEDICATED_SERVER`). The smoke passes with it excluded from the server install.

**Why.** A client launch is slow and manual; the server boot catches mod-loading and dist errors in minutes, headless.

## 2026-10-18 — Create 6.0.8 and its add-ons; five mods removed (branch `create6`)

**Decision.**
- Create 0.5.1.j → 6.0.8 (bundles Flywheel 1.0.5, Ponder 1.0.91, Registrate). Crafts & Additions 1.3.3, Steam 'n' Rails 1.7.3 (Create 6 release build), Enchantment Industry 2.5.4b with its required Create: Dragons Plus 1.11.9, Ars Creo 4.3.0. New: Create Deco 2.0.3, Connected 1.2.3, New Age 1.2.0 (bundles ESL), Interiors 0.6.0, Jetpack 4.4.6, Ore Excavation 1.6.6, Hypertubes 0.6.0. All are Modrinth direct-URL metafiles.
- Supplementaries 2.5.21 → 3.1.44 and Moonlight 2.7.2 → 2.16.37. 2.5.21's Create compat references `com.simibubi.create.content.logistics.filter.ItemAttribute`, which Create 6 moved; its deferred setup threw `NoClassDefFoundError`, left mod loading broken and crashed the client. 3.1.44 declares `create [6.0.0,]`.
- The Create, Steam 'n' Rails, Ars Creo and Supplementaries configs are the files the new versions wrote back (Forge/Moonlight config correction): every surviving key keeps its value; removed keys are features that moved to other mods (Supplementaries' wall lanterns, hanging signs, cake/skull/bell tweaks now live in Amendments, which is added below).
- Amendments 2.2.6 (1.20-2.2.6, Modrinth `nJORWvdh`) added to restore the features Supplementaries 3 split out. Its only mandatory mod dependency is Moonlight (`1.20-2.16.0`, met by 2.16.37); Supplementaries (`[1.20-2.8.0,)`) and Flywheel are optional.
- Removed at the owner's request: Bad Wither No Cookie - Reloaded, MrCrayfish's Furniture (Legacy), Mob Despawn Timers and Craft Shack. **Terralith is kept** (owner ruling 2026-10-18; it is baked into existing worlds). **Craft Shack's metafile installs `FallingTree-1.20.1-4.3.4.jar`**, so tree felling goes too. None declared a library dependency, so no library was orphaned. Their configs and Mods menu entries were dropped; Terralith's ForgeEndertech files and Mods menu entry stay.
- **FallingTree re-added standalone (owner request 2026-10-19).** `mods/fallingtree.pw.toml` is FallingTree 1.20.1-4.3.4 (Modrinth `Fb4jn8m6`, the same jar as the CurseForge file Craft Shack installed; side both, since Modrinth lists it server-only with optional client). `config/fallingtree.json` is restored unchanged. Craft Shack itself stays removed.

**How it was checked.** Every installed jar's class constants were scanned for `com/simibubi/create/` references missing from Create 6 and its bundled jars (only Supplementaries 2.5.21 failed), and every mandatory `mods.toml` dependency was resolved against the installed set (scripts in `artifacts/evil-eye-pack/jobs/2026-10-18-create6/tools/`).

**Consequences for existing worlds.**
- **A world created with Terralith does not open without it** ("Overworld settings missing"): `level.dat` stores the overworld's multi-noise biome list inline, ~880 of its entries are `terralith:` biomes. The Stable world's `level.dat` has 890 Terralith references. Detaching the biome list (GOTCHAS) was verified on a copy of the trial world, which then opened and the player joined; the owner chose to keep Terralith, so no migration is needed.
- Enchantment Industry 2.x is a rewrite: the Disenchanter, hyper experience and ink entries are gone and are not remapped. MrCrayfish furniture (about 900 registry entries) and Falling Tree's behaviour disappear.
- Supplementaries' `falling_lantern` (moved to Amendments) disappears.

## 2026-10-16 — How the EMI Mods menu is drawn, filters and measures text

**Decision.**
- **Drawn in `ScreenEvent.Render.Post`, not as widgets.** Only the Mods button is a widget. The dropdown is painted by the script after the screen, EMI's sidebar panels and tooltips, at a high z, and hit-tested from the `MouseButtonPressed.Pre` hook. Tooltips under it are cancelled in `RenderTooltipEvent.Pre`.
- **Filtering calls `EmiScreenManager.search.setValue("@<modid>")`.** `EditBox.setValue` runs the widget's responder, which is the path typing takes, so EMI refilters with no EMI-internal calls and no config writes.
- **Text uses `GuiGraphics.drawWordWrap` and estimated widths.** `drawString` and `Font.width` are never called.

**Why.**
- Widgets added at `Init.Post` are drawn with the screen, and EMI's panels paint over them.
- `setValue` is the one supported entry point that makes EMI refilter.
- In KubeJS 2001.6.5 the `drawString`/`Font.width` overloads are "ambiguous" (`InternalError: The choice of Java method GuiGraphics.m_280488_ ... is ambiguous`), and SRG names and explicit signatures both fail with "not found as any of ..." (`logs/kubejs/client.log`, commits 0360f9f and 25fcb0f). `drawWordWrap(Font, FormattedText, int, int, int, int)` has a single overload in 1.20.1, and the client.log member listing confirmed `drawWordWrap` is exposed. Widths come from vanilla's default-font advances (6 px upper bound), so rows are never narrower than their text. Verified working in game at 295f12a.

**Rejected.** Widgets at `Init.Post` (covered by EMI panels); `Font.width`/`drawString` via SRG or explicit signatures (do not resolve); a "stop drawing after one failure" switch (makes the UI unusable); calling EMI's search internals directly.

**Layout of the scripts.** The UI scripts moved to `emi_curation/ui/` (button, placement, mods_menu, mods_list, mods_text, forge_hooks) to keep the folder under the 12-file cap. KubeJS 2001.6.5 loads `client_scripts` recursively into one pack and sorts the whole pack by `// priority:`, so priorities hold across folders (`KubeJS.loadScripts` uses `Files.walk`; `ScriptManager` sorts once).

## 2026-10-12 — EMI adopted as the pack's recipe viewer

**Decision.** `emi-trial` was merged into `main`. The pack now ships EMI 1.1.24, JEI 15.62.0.219 and Just Enough Professions 3.0.1 (with the KubeJS curation scripts and `config/emi-curation/`) instead of REI, REI Plugin Compatibilities and Roughly Enough Professions. The trial entries below remain the rationale.

**Why.** The owner playtested the trial and approved it. Curation, the CLEAN/ALL button and plugin coverage carried over (`docs/emi-coverage.md`).

**Consequences.**
- Existing instances remove the REI jars and configs on their next sync (via `.minecraft/packwiz.json`). Stored REI favorites are not migrated.
- `docs/emi-trial.md` became `docs/emi.md`. The `emi-trial` worktree and the Evil Eye EMI Trial instance are no longer needed.
- Merged with the Eat Quiet resource pack and Resource Pack Overrides from `main`; `index.toml` and `pack.toml` were regenerated with `rehash.cjs`, not hand-merged.

## 2026-10-11 — Source, experiments, artifacts and instances kept apart

**Decision.**
- The main checkout stays at `projects/evil-eye-pack/`. Experiments are linked worktrees under `projects/worktrees/evil-eye-pack/<name>/`. Job prompts, plans and reports go to `projects/artifacts/evil-eye-pack/jobs/<date-task>/`.
- Each experiment gets its own MultiMC instance. **Evil Eye (Stable)** (folder `Evil Eye Stable`, formerly `Evil Eye Dev1`) installs published `main` and holds the owner's worlds. **Evil Eye Local** installs the main checkout straight from its file path (no server, 2026-10-11). **Evil Eye EMI Trial** installs the `emi-trial` worktree from its file path.
- Generic pack tooling (`tools/packwiz/`, `.gitattributes`, `.packwizignore`) was promoted from `emi-trial` to `main` alone, without the EMI gameplay change.

**Why.** Worktrees isolate source; instances isolate installed jars, installer state, configs and worlds. Fixed ports make it obvious which checkout an instance installs. Loopback HTTP is the workflow packwiz documents for local testing and the repo already had the server; a `file:` URL was not used.

**Rejected.**
- One enclosing directory for source and launcher: more path changes, no better boundaries.
- Plain branch switching for experiments: a running feed would silently serve the other branch.
- Testing in the Stable instance: risks the owner's worlds and installer state.
- Cherry-picking the whole `emi-trial` commit: it would also replace REI on `main`.

## 2026-10-11 — Node-only pack tooling

**Decision.** Hash verification, index rebuild and the localhost pack server are Node 22 scripts under `tools/packwiz/`. There is no packwiz CLI, Python or build step on this machine.

## 2026-10-11 — EMI trial: EMI + JEI + JEP on a separate branch and instance

**Decision.** Trial EMI 1.1.24+1.20.1+forge on `emi-trial`, in a copied MultiMC instance,
alongside JEI 15.62.0.219 and Just Enough Professions 3.0.1. REI, REI Plugin
Compatibilities and Roughly Enough Professions are removed on that branch only. `main`
stays on REI until the owner decides.

**Why.**
- EMI only runs JEI plugins through its JEMI bridge when JEI itself is installed. Most of this pack's integrations are JEI plugins (see `emi-coverage.md`).
- JEI `15.62.0.219` (was `15.20.0.102`, bumped 2026-10-12): Polymorph 0.49.11 declares `jei [15.57.0.207,)` even though the dependency is optional, and Forge enforces the range, so 15.20.0.102 aborted mod loading. 15.62.0.219 is the newest 1.20.1 Forge JEI; EMI (`[15.20.0.0,)`), JEP (`[15.0.0.12,)`), AE2 (`[15.0.0,16.0.0)`), Create Crafts & Additions (`[15.0.0.0,)`) and Almost Unified (`[15.1.0.18,)`) all accept it. Change it only for a demonstrated dependency or API need, and record why.
- REP is REI-only. JEP gives the same profession and workstation displays through JEI.
- REI Plugin Compatibilities also declares mod id `jei`, so it cannot coexist with real JEI.

## 2026-10-11 — Curation as reversible runtime views, not EMI's native removal

**Decision.** Pack curation stays in `config/emi-curation/*.json`. KubeJS client scripts
apply it as in-memory views:
- CLEAN swaps `EmiStackList.filteredStacks` for a filtered immutable copy and installs a JS `EmiRecipeManager` wrapper that filters recipe displays with REI's rule.
- ALL reinstalls EMI's own objects.

**Rejected.**
- EMI's native `assets/emi/index/stacks/*.json` `removed`/`filters`. These change the baked index and cannot be turned off at runtime. `disable: true` also drops recipes and checks catalysts, which REI did not.
- Writing the hide list into EMI's user-hidden stacks. That persists to `emi.json`, mixes pack policy with the owner's own hides, and a toggle would have to save files.
- A custom Forge mod. It would avoid the dependency on EMI internals, but it adds a build and hosting step this config-first pack doesn't have.

**Consequences.**
- The views depend on EMI internals, so EMI is pinned.
- The scripts re-apply after every EMI reload or recipe-worker swap and never wrap their own wrapper.
- A toggle never triggers an EMI reload or any file write.
- In CLEAN, "hidden" for display filtering means hidden by the pack, hidden by the owner in EMI, or removed from EMI's index entirely. This matches REI's manual, basic and tag rules. `index-source: creative-plus-registered` keeps the last case equal to "removed by EMI or a plugin".

## 2026-10-11 — Exact source set for curation; Node-only tooling

**Decision.**
- The five item lists were split once from the frozen REI 12.1.785 config (1,759 IDs; not regenerated from naming patterns). `tools/analysis/emi_curation/migrate_rei.cjs`, its `fixtures/rei-config.json5` and `migration.test.cjs` were retired 2026-10-20 (dk-eaeaf6eb, dk-232fd37d): the import was done, `--check` pinned live hand-curated counts so any normal edit broke it, and it re-declared validation that `policy.compile` owns. Ongoing list integrity (schema, id format, duplicates) is `policy.compile`, exercised against the real config by `policy.test.cjs`. The fixture and script are recoverable from git at commit a61035d.
- The README's old "377 colour variants" figure was 361 colour variants plus 16 MineColonies eggs.
- Tooling is Node-only: tests, hash verifier, index rebuild and localhost server. The planned `py -3.11` scripts were ported because this machine has no `py` launcher or system Python, and Node is needed for the KubeJS tests anyway.

## 2026-11-02 - IPN round-2 bounded subset

Use the orchestrator-authorized shippable fallback: Client 0.5.0/Tweaks 0.8.0 own vanilla move-all and provenance-based hand refill. Keep IPN/libIPN for sorting and Kotlin for retained consumers. Disable IPN's competing refill and move-all switches through shipped config and pack-owned keys. This deliberately leaves modded-storage move-all, including Dank, unavailable pending verified bulk adapters. No claim of complete IPN replacement or removal acceptance is made. No instance was modified.

## IPN replacement (2026-11-02, round 4)

Supersede the round-2 subset with the complete bounded replacement in Client 0.5.1/Tweaks 0.8.1. Remove IPN and libIPN in one step and retain Kotlin for its other consumers. Preserve owner-local IPN files as inert data; installers must not recreate or change them. Unsupported complex/virtual storage stays excluded under the owner-approved rescope.
