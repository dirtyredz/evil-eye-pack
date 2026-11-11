# Owned-mod consolidation

## Furniture survey (2026-11-02)

The [furniture and wood-variant findings](furniture-survey.md) compare 23 pinned primary
jars plus adjacent decor, historical archived placements and material-driven rendering.
Start with owner style selection and reversible EMI curation; no content is removed.
Physical furniture removal remains a separate dependency/remap/restart acceptance task.

## Wave 7 evidence checkpoint (2026-11-02)

Keep Polymorph, Diagonal Fences and Create: Compatible Storage, as accepted in the
wave-7 plan. Create: Storage Drawers Compat also stays until its native replacement
passes both historical Forge and NeoForge payload preservation and source-absent
parity. No physical jar is removed: 157 metafiles remain. Tweaks stays 0.9.0 and
Client stays 0.7.0; no replacement gameplay or renderer is shipped here.

New offline tooling separates candidate closure profiles from archive traversal and
records all eleven storage codec IDs, Polymorph selections, placed diagonal counts
and full mounted payloads from a verified historical snapshot. Evidence lives under
`~/.local-state/evil-eye-pack/artifacts/jobs/2026-11-02-drawers-compat/`; the handoff records actual
gate results and missing offline prerequisites. This does not complete the absorption.

Small gameplay, presentation and compatibility mods are replaced by three owned mods built in the
`minecraft-mods` workspace: **EvilEyeTweaks** (`evileye_tweaks`, server gameplay and small compat),
**EvilEyeClient** (`evileye_client`, HUD/screens/controls/appearance) and **EvilEyeEssentials**
(`evileye_essentials`, commands and persistent player/server state). Each wave is independently
shippable and ends with owned release(s), pins, upstream drops, config migration and acceptance.
An upstream jar stays until its replacement passes the full effective contract; a vanilla fallback
does not count. Full program plan: `artifacts/minecraft-mods/jobs/2026-11-01-evileye-tweaks/handoff-wide.md`.

## Waves

| Wave | Candidates (target) | Status |
|---|---|---|
| 1 | Fuel Goes Here, Double Doors (T), Collective after closure | **Included in the supplied main base** (historical release details): Tweaks 0.2.0 local pin, three drops; owner walk pending |
| 2 | Yeetus Experimentus, Pick Up Notifier, Stylish Effects, Colorful Hearts, Enchantment Descriptions, AppleSkin (C, with T producers) | **Included in the supplied main base** (historical release details): Client 0.1.0 and Tweaks 0.3.0 local pins, six drops; Bookshelf kept (AttributeFix requires it); owner walk pending |
| 3 | Better Advancements, Controlling, Default Options, Resource Pack Overrides, Just Enough Professions, Mouse Tweaks, Crafting Tweaks | **Included in the supplied main base** (historical release details): Client 0.2.0 and Tweaks 0.5.0 local pins (since superseded by Client 0.3.2 and Tweaks 0.6.0, which remove the crafting-grid controls), seven drops plus Searchables and Balm after closure; owner walk pending |
| 4 | AttributeFix, Companion, FallingTree, Flat Bedrock, Hourglass, Clumps, Let Me Despawn (T) | **Included in the supplied main base** (historical release details): Tweaks 0.4.0 local pin, seven drops plus Bookshelf, Prickle, Almanac Lib and Kiwi after closure; owner walk pending |
| 5 | FTB Essentials (E; mandatory saved-data migration), FTB Library (sidebar to C) | **Included in the supplied main base** (historical release details): Essentials 0.1.0, Client 0.3.6 and Tweaks 0.6.1 local pins (0.3.1 = Trial fixes: hearts, trash-can icon, pick-up scale; 0.3.2 and 0.6.0 remove the crafting-grid controls; 0.3.3 = one-line labelled food and drink tooltips; 0.3.5 = Electromagnet charge widget; 0.3.6 = Ender IO + EMI tooltip layer and missing-slot highlight fixes; Tweaks 0.6.1 = Slow Falling drop threshold), two drops; import trial passed on a world copy; owner walk pending |
| 6 | Pro Placer, Light Overlay (removed outright 2026-11-01), Connected Glass (removed outright 2026-11-02), 3D Skin Layers, Quick Skin, Modern UI, Inventory Profiles Next, Chloride (C) | IPN done (Client 0.6.1 / Tweaks 0.9.0); Chloride removed outright 2026-11-02; Modern UI, Quick Skin and 3D Skin Layers retained; Pro Placer absorbed by Client 0.7.0 on feat/pro-placer; owner client acceptance pending |
| 7 | Polymorph, Cosmetic Armor Reworked (**done 2026-11-02**, see the equipment panel wave), Diagonal Fences, Create: Compatible Storage, Create: Storage Drawers Compat (conversion-gated) | not started |

## Retained

Content/worldgen mods, Amendments and other registered-content mods, the rendering and
optimisation engines (Sodium, Iris, ModernFix, FerriteCore, Entity Culling, FastFurnace/FastSuite/
FastWorkbench and similar), Xaero maps, Jade, EMI, JEI, appearance frameworks (CPM, EMF, ETF, Fusion),
required libraries, KubeJS/Rhino, spark and the world-migration bridge. Possibly orphaned libraries
are removed only after a full dependency and consumer audit.

## Physical mod metafiles

| Point | `mods/*.pw.toml` |
|---|---|
| Before wave 1 (2026-11-01, after Light Overlay removal) | 191 |
| After wave 1 | 189 |
| After wave 2 | 184 |
| After wave 4 | 173 |
| After wave 3 | 164 |
| After wave 5 | 163 |
| After Tool Belt removal (outright, 2026-11-01) | 162 |
| After the equipment panel wave (Cosmetic Armor Reworked absorbed, 2026-11-02) | 161 |
| After IPN/libIPN absorption | 159 |
| After Chloride removal | 158 |
| Pro Placer candidate (this branch) | 157 |
| After Connected Glass removal (outright, 2026-11-02; vanilla glass connects through Fusion resources) | 156 |

## Rules

- Upstream jars here are mostly All Rights Reserved: behaviour is reimplemented, never copied. Each owned
  mod keeps `docs/upstream-contracts.md` with exact versions, hashes and deliberate differences.
- Before each drop: declared dependencies, nested jars, class references, scripts, tags, resource paths
  and serialized ids. Keep resource namespaces existing data relies on (Tweaks keeps
  `fuelgoeshere:forced_fuels`), and never list such a namespace in pack-test `removedMods`.
- Translate real configs and keybindings before deleting old files; record each added config in
  `tools/packwiz/migration/config-decisions.json`.

## Wave 5 notes

- **EvilEyeEssentials 0.1.0** (`evileye_essentials`, side `both`) replaces FTB Essentials 2101.1.10: homes,
  warps, `/back`, spawn, tpa, rtp (off), kits, nicknames, mutes, fly/god, heal/feed, invsee, enderchest,
  trash can, virtual workstations, with the pack's values as its defaults (`config/evileye_essentials-common.toml`).
- **Saved data import.** On every server start Essentials imports `<world>/ftbessentials` once (keyed by the
  files' checksum; `/evileye_essentials import ftb [dry_run]` by hand). Before writing it copies the FTB files
  (read-only) and its previous state to `<world>/evileye_essentials/imports/ftb/<stamp>-<checksum>/`; it never
  overwrites a home, warp or kit that already exists, and a missing dimension or unloadable kit item blocks the
  whole import with a report instead of importing part of it. The FTB files are left in place.
- **Import trial** on a copy of the converted trial world (minecraft-mods
  `jobs/2026-11-01-evileye-essentials-wave5/import-trial`): 2 players, 1 home, 20 `/back` entries, 0 warps,
  0 kits, 0 conflicts; a second run reports "already imported". 11 `time` stamps (a 2001.x field) are archived.
- **FTB Library** goes with it (only FTB Essentials required it; class-reference scan of the other 162 pinned
  jars: `jobs/2026-11-01-evileye-essentials-wave5/ftb-closure.txt`). Its sidebar buttons (gamemode, day, night,
  rain, trash can) are rebuilt in **Evil Eye Client 0.3.0** (`inventory/sidebar`), shown only when the server
  offers the command, so the first four stay operator-only. Architectury stays for Quick Skin.
- **Configs**: `defaultconfigs/ftbessentials-server.snbt` and `config/sidebar_buttons.json` are carried into
  `config/evileye_essentials-common.toml` and `config/evileye_client-client.toml` `[sidebar]`. The converted
  trial world's `serverconfig/ftbessentials.snbt` held FTB's defaults (one home, 10 s cooldowns, rtp on), so the
  pack values never reached it; Essentials restores them. The `kubejs/data/ftbessentials` rtp tag is dropped:
  Essentials' own `evileye_essentials:ignore_rtp` has the same leaves and bedrock.

## Wave 2 notes

- **EvilEyeClient** (`evileye_client`, side `client`) holds the presentation; **EvilEyeTweaks 0.3.0**
  adds the server producers (pick-up receipts for backpack/Dank absorption, saturation/exhaustion
  snapshots). They talk through optional payloads and inter-mod sinks; neither compiles against the other.
- **Bookshelf stays**: AttributeFix declares it required (it was expected to be orphaned by Enchantment
  Descriptions). It went with AttributeFix in wave 4. Puzzles Lib (Diagonal Fences, Pro Placer) and
  Prickle (AttributeFix) also stay.
- **Thirst Was Taken** only drew its quenched overlay, drink preview, thirst exhaustion bar and drink
  tooltips when AppleSkin was installed; Evil Eye Client redraws them (`integration/thirst/`).
- **Resource paths kept**: the food sheet stays at `appleskin:textures/icons.png` so CozyUI+'s re-skin
  applies; coloured hearts are tinted from the active pack's hearts (CozyUI+ since 2026-11-02; the New
  Hearts copy was removed), so its shapes carry to every row.
- Configs: `stylisheffects-client.toml`, `colorfulhearts.toml`, `appleskin-client.toml` and
  `enchdesc.json` are carried into `config/evileye_client-client.toml` (see config-decisions).

## Wave 4 notes

- **EvilEyeTweaks 0.4.0** holds the pack-wide gameplay rules: `entity/attributes`, `entity/pets`,
  `entity/experience`, `entity/despawn`, `world/trees`, `world/time`, `world/bedrock` (nested by subject
  to keep the package root readable). Effective settings are in `config/evileye_tweaks-common.toml`.
- **Libraries dropped after closure**: Bookshelf and Prickle (only AttributeFix), Almanac Lib with its bundled
  DungeonConfig (only Let Me Despawn), Kiwi (only Companion). `migrate.mjs resolve` checks declared
  dependencies; a class-reference scan of every kept jar, nested jars and the owned jars found no other user
  (`jobs/2026-11-01-evileye-tweaks-wave4/library-closure.json`).
- **Saved data** in the converted trial world: five experience orbs with Clumps' `clumpedMap` (converted on
  load by `LegacyClumpsOrbData`), Companion's three game rules at their defaults (not carried as game rules),
  no Let Me Despawn/Almanac keys, no FallingTree toggles, nothing from AttributeFix, Hourglass, Flat Bedrock
  or the libraries. Hourglass's `serverconfig/hourglass-server.toml` stays in existing worlds, unread.
- **Day length** now uses NeoForge's day-time rate, which NeoForge saves in level.dat (`neoDayTimePerTick`).
- **Configs**: `config/attributefix.json` (an obsolete format the 1.21.1 jar never read), `config/fallingtree.json`
  and `defaultconfigs/hourglass-server.toml` are carried into `config/evileye_tweaks-common.toml`. No
  keybindings were involved.

## Equipment panel (2026-11-02)

Cosmetic Armor Reworked is absorbed into the owned mods: **Evil Eye Client 0.4.0** (equipment panel: Curios key G and the inventory's Curios button open one screen with equipped curios, real armour, the model, cosmetic armour and cosmetic curios; cosmetic armour rendering; includes 0.3.3-0.3.6) and **Evil Eye Tweaks 0.7.0** (owned cosmetic armour storage in player persistent data, the `evileye_tweaks:equipment` menu; includes 0.6.1). **Evil Eye World Migration 0.1.0-dev.11** imports the old sidecars (`playerdata/<uuid>.cosarmor`; includes dev.10's region-file fix). The mod metafile, both configs and the CozyUI texture override are gone.

## Wave 3 notes

- **Evil Eye Client 0.2.0** adds `screens/advancements` (Better Advancements), `screens/controls`
  (Controlling), `inventory/gestures` (Mouse Tweaks), `inventory/crafting` (Crafting Tweaks' keys,
  result right-click and hidden recipe-book button; **0.3.2 removed the keys and right-click, unused, and the
  button hiding now lives in `inventory/recipebook`**), `integration/professions` (Just Enough Professions, a JEI
  category EMI shows through its JEI bridge), `options/defaults` (Default Options) and `options/resourcepacks`
  (Resource Pack Overrides). The wave-2 HUD packages moved under `hud/`.
- **Evil Eye Tweaks 0.5.0** added `inventory/crafting`: the server performed every crafting-grid action the
  client keys requested (rotate, balance, spread, clear, refill last, compress/decompress, stack crafting); the
  furnace routing moved beside it under `inventory/furnace`. **Tweaks 0.6.0 removed all of it** (owner decision,
  2026-11-01: unused; EMI's + recipe fill and DankRecipeTransfer are what the owner uses and are untouched).
- **Libraries dropped after closure**: Searchables (only Controlling) and Balm (only Crafting Tweaks and Default
  Options; Xaero's Minimap references it only from its Waystones compat, and Waystones is not in the pack).
  `jobs/2026-11-01-evileye-wave3/library-closure.json`.
- **Saved data** in the converted trial world: none. The seven mods and both libraries appear only in level.dat's
  loaded-mod list (`jobs/2026-11-01-evileye-wave3/world-scan.json`, read-only scan of every NBT file and
  46,146 region/entity/POI chunks).
- **Configs**: `config/betteradvancements-client.toml`, `config/MouseTweaks.cfg` and
  `config/craftingtweaks-common.toml` [client] are carried into `config/evileye_client-client.toml`
  (`[advancements]`, `[gestures]`, `[crafting]`, now `[recipeBook] hideButton` only); the Crafting Tweaks [common] values went into
  `config/evileye_tweaks-common.toml` `[crafting]`, removed again with Tweaks 0.6.0. `config/resourcepackoverrides.json` becomes the pack-owned
  `config/evileye_client/resourcepacks.json` with NeoForge's pack ids: the old file named the Forge
  `file/Eat-Quiet-...zip` and `builtin/towntalk`, so on the migration branch Eat Quiet was neither selected nor
  required and Town Talk was never enabled. `config/defaultoptions/keybindings.txt` stays where it was (same
  syntax); its Crafting Tweaks line was renamed to Evil Eye Client's key and then removed with it in 0.3.2.
- **Keybindings**: Evil Eye Client 0.2.0 to 0.3.1 registered `key.evileye_client.crafting.*` and adopted saved
  `key.craftingtweaks.*` bindings; 0.3.2 registers no crafting keys (saved crafting bindings in options.txt are
  harmless leftovers).

## IPN replacement history (2026-11-02)

Round 2 ships the authorized bounded subset in Client 0.5.0/Tweaks 0.8.0: vanilla-storage move-all and native-use selected-hand/offhand refill. IPN refill/move-all are disabled, including preserved-config enforcement; IPN/libIPN remain for sorting and Kotlin remains for its other consumers. Sorting parity and Dank bulk storage are still unfinished, so this is not full replacement acceptance. The complete handoff is artifacts/minecraft-mods/jobs/2026-11-02-ipn-build/handoff.md.

Round 3 repeated the ad hoc audit against the subset jars: 161 hash-verified roots, 239 archives
(78 nested jars), 85,097 classes and 215 metadata files, with no scan errors. Excluding IPN/libIPN
leaves 84,013 classes and no targeted IPN references or dependencies. Create Jetpack, nested FlightLib
and Cull Less Leaves still require Kotlin. Evidence: `~/.local-state/evil-eye-pack/artifacts/jobs/2026-11-02-ipn-round3/`.
This verifies the bounded candidate, not full-removal acceptance. Both mod gates, 574 pack Node tests,
the client transformation audit and a cached-only headless smoke passed. Migration-lock validation
still fails on the pre-existing Mekanism size record; see the handoff.

## IPN cutover (round 4)

Client 0.5.1/Tweaks 0.8.1 replace sorting, move-all and refill. IPN and libIPN are removed together; Kotlin remains for Create Jetpack, nested FlightLib and Cull Less Leaves. Mod metafiles: **161 -> 159**. Supported storage is the conservative vanilla set, player main inventory for sorting, and Dank through its bulk seam. Complex/virtual menus remain native-only. Automated evidence and owner UI/multiplayer acceptance limits are recorded in artifacts/minecraft-mods/jobs/2026-11-02-ipn-build/handoff.md.

## Settings and action rail release (2026-11-02)

Client 0.6.1, Tweaks 0.9.0 and Essentials 0.2.0 combine the completed IPN replacement with the owned settings screen/service. The outside-panel rail orders applicable actions as to-player, to-storage, sort, trash; EMI/JEI reserve its rectangle. Inventory effects are forced left, rail right, and operator commands remain in the sidebar. See the current pins in [NeoForge migration](neoforge-migration.md#stable-ipn-settings-and-action-rail-release-2026-11-02).

## Chloride retirement (2026-11-02)

Owner decision supersedes the wave-6 retention proposal: remove Chloride and its unused graphics tweaks; retain Modern UI, Quick Skin and 3D Skin Layers. Modern UI zoom is explicitly enabled in `config/modernui/client.toml` and defaults to Z. Physical mod metafiles: **159 -> 158**. Sodium stays (Iris requires it); bundled WaterConfig leaves with Chloride, with no separate library drop.

Existing instances preserve saved keybindings, including Stable's Modern UI C binding. `pack-owned-keys.json` only supports JSON/TOML, not `options.txt`; no forcing entry or Stable edit is made. Smallest safe follow-up: add an exact-key colon-delimited options setter to the existing prelaunch installer, tested for missing/saved/duplicate bindings and idempotence, preserving every unrelated line, then force only `key_key.modernui.zoom:key.keyboard.z`. Until then, existing players can rebind Modern UI zoom to Z in Controls.

Closure evidence: `.tmp/chloride-closure.json` in the removal worktree scanned 159 pinned roots, 237 archives (78 nested), 84,088 classes and 213 metadata files without errors. Excluding Chloride and its bundled WaterConfig leaves 83,847 classes: no WaterConfig references or declared Chloride consumers. The broad Chloride string hits in five other jars are chemistry content and Lucene dictionary words, reviewed individually. Repository recipes reference only unrelated hydrogen-chloride chemistry.

## Pro Placer absorption (2026-11-02, Client 0.7.0)

Client 0.7.0 independently implements reach-around bridging, continuous row/column placement and creative breaking. Four described [placement] settings carry the observed defaults; the owned unbound toggle adopts saved legacy bindings, including modifiers and explicit unbinding. Existing preserved Client configs acquire this new section through normal spec correction. The untracked Pro Placer config remains inert for rollback. No server protocol or world conversion is needed.

Pro Placer is removed: **158 -> 157** physical mod metafiles. Puzzles Lib stays for Diagonal Fences and its nested Diagonal Blocks. Modern UI, Quick Skin and 3D Skin Layers stay. Chloride was already removed by the later owner decision in the supplied base; this change does not restore or otherwise alter it. Exact-ID exclusions replace the unused matcher grammar; block items only and stronger lifecycle cleanup are deliberate differences.

Evidence: ~/.local-state/evil-eye-pack/artifacts/jobs/2026-11-02-pro-placer; full handoff: artifacts/minecraft-mods/jobs/2026-11-02-pro-placer/handoff.md. No push, merge, instance writes or promotion. Owner client input and multiplayer acceptance remain required.
