# Owned-mod consolidation

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
| 1 | Fuel Goes Here, Double Doors (T), Collective after closure | **Pinned on branch** `migration/evileye-tweaks-wave1`: Tweaks 0.2.0 local pin, three drops; owner walk pending |
| 2 | Yeetus Experimentus, Pick Up Notifier, Stylish Effects, Colorful Hearts, Enchantment Descriptions, AppleSkin (C, with T producers) | **Pinned on branch** `migration/evileye-tweaks-wave1`: Client 0.1.0 and Tweaks 0.3.0 local pins, six drops; Bookshelf kept (AttributeFix requires it); owner walk pending |
| 3 | Better Advancements, Controlling, Default Options, Resource Pack Overrides, Just Enough Professions, Mouse Tweaks, Crafting Tweaks | not started |
| 4 | AttributeFix, Companion, FallingTree, Flat Bedrock, Hourglass, Clumps, Let Me Despawn (T) | **Pinned on branch** `migration/evileye-tweaks-wave1`: Tweaks 0.4.0 local pin, seven drops plus Bookshelf, Prickle, Almanac Lib and Kiwi after closure; owner walk pending |
| 5 | FTB Essentials (E; mandatory saved-data migration) | not started |
| 6 | Pro Placer, Light Overlay (removed outright 2026-11-01), 3D Skin Layers, Quick Skin, Modern UI, Inventory Profiles Next, Chloride (C) | not started |
| 7 | Polymorph, Cosmetic Armor Reworked, Diagonal Fences, Create: Compatible Storage, Create: Storage Drawers Compat (conversion-gated) | not started |

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

## Rules

- Upstream jars here are mostly All Rights Reserved: behaviour is reimplemented, never copied. Each owned
  mod keeps `docs/upstream-contracts.md` with exact versions, hashes and deliberate differences.
- Before each drop: declared dependencies, nested jars, class references, scripts, tags, resource paths
  and serialized ids. Keep resource namespaces existing data relies on (Tweaks keeps
  `fuelgoeshere:forced_fuels`), and never list such a namespace in pack-test `removedMods`.
- Translate real configs and keybindings before deleting old files; record each added config in
  `tools/packwiz/migration/config-decisions.json`.

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
  applies; coloured hearts are tinted from the active pack's hearts, so New Hearts' shapes carry to
  every row.
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
