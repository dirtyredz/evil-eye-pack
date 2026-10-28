# Evil Eye

A [packwiz](https://packwiz.infra.link/) modpack for Minecraft 1.20.1 (Forge 47.4.10), built from
the owner's Evil Eye MultiMC instance (now **Evil Eye (Stable)**, folder `Evil Eye Stable`). This repo
holds mod/shaderpack metadata and config files only (no jars are committed) — packwiz downloads the
actual mod files from CurseForge/Modrinth on demand.

Working on the pack (local test instances, worktrees, hashing): see
[docs/development.md](docs/development.md).

Recipe viewer: **EMI** with JEI (for its plugins) and Just Enough Professions, replacing REI. The item
hide lists live in `config/emi-curation/` and are applied by `kubejs/client_scripts/emi_curation/`;
see [docs/emi.md](docs/emi.md) and [docs/emi-coverage.md](docs/emi-coverage.md). The notes below that
mention REI describe how those lists were first built and were migrated to EMI unchanged.

## What's in it

- **Roundwood 0.13.3** adds round and arched doors, windows with Cross Beams, ordinary/keyhole archways and Universal Trim, with in-world material and dye styling. Its own `/roundwood showcase` builds a labelled display (see [showcases](docs/showcases.md#roundwood-native-showcase)).
- **Hourglass 1.2.1.1** slows daytime to half speed while night remains at vanilla speed. Its optional smooth-sleep feature is disabled, so beds keep vanilla sleep behavior.
- **FlatWorldFix 1.0.0** preserves a chosen non-default world type, such as Superflat, over datapack overworld overrides. Default worlds keep Terralith. It only affects worlds created while installed; existing saves are untouched.
- Create contraption storage: Create: Compatible Storage 2.14.0 adds Iron Chests support; Create: Storage Drawers Compat 1.1.0 adds mounted drawer storage and manual access. Both accompany Create 6.0.8 (see `docs/DECISIONS.md` and `docs/GOTCHAS.md`).

- 182 mods (metafiles pointing at CurseForge, Modrinth or a GitHub release, matched by hash to the exact versions used
  in the source instance — no upgrades)
- `config/` — the instance's mod configs, indexed as plain files by packwiz
- `shaderpacks/` — Complementary Unbound, Complementary Reimagined, and MakeUp UltraFast, plus their
  saved shader-option `.txt` files

## Using this pack in MultiMC

1. Create a new MultiMC instance: Minecraft 1.20.1 + Forge 47.4.10.
2. Download `packwiz-installer-bootstrap.jar` from the
   [packwiz-installer-bootstrap releases page](https://github.com/packwiz/packwiz-installer-bootstrap/releases)
   and save it somewhere permanent (not inside the instance folder, so MultiMC updates don't touch it).
3. In the instance's **Settings → Custom Commands**, enable a pre-launch command:

   ```
   $INST_JAVA -jar "/path/to/packwiz-installer-bootstrap.jar" https://raw.githubusercontent.com/dirtyredz/evil-eye-pack/main/pack.toml
   ```

   (Swap in wherever `packwiz-installer-bootstrap.jar` actually lives. To test unpushed changes, use a
   separate instance pointed at a locally-served copy; see [docs/development.md](docs/development.md).)
4. Launch the instance. The bootstrapper downloads/updates every mod, config file, and shaderpack
   to match this repo before Minecraft starts. Re-launching after a `git pull` + push updates the
   instance to match.

## Notes

- `config/fancymenu/` is intentionally excluded — that mod was removed from the pack.
- One config file (`resourceful-config-web.json`) was excluded because it contained a web-config
  password; Resourceful Config's web server is left disabled by default anyway.
- Curios 5.x draws its slot panel inside the vanilla inventory screen, so the
  `curios:curios_container` entry in Stylish Effects' `menu_blacklist` does not prevent overlap.
  Keep `screen_side = "RIGHT"` under `[renderers.inventory_renderer]` in
  `config/stylisheffects-client.toml`.
- Wither bones use Ice and Fire's: the permanent KubeJS tag policy supplies `forge:wither_bones`, and BHC's code-driven bone drop is disabled. See [duplicate cleanup](docs/duplicate-cleanup.md).
- Dragon griefing is set to `2`, which Ice and Fire defines as **no griefing** (not weak-block griefing). Tamed griefing, stuck digging, Cyclops griefing and Sea Serpent griefing are disabled.
- AdLODs iron/copper deposits have half the size (350-700 blocks) and half the frequency (rarity 2040/2904), yielding roughly one quarter of their previous added ore volume. Vanilla ore generation is unchanged. Zinc deposits use explicit Create ore IDs. These generation changes and rarer Myrmex colonies affect new chunks; the colony cap is now 30.
- Only ender dust is newly unified: Ender IO uses `forge:dusts/ender`, so its `powdered_ender_pearl` is also added to `forge:dusts/ender_pearl`, owned by AE2. The reciprocal tag addition puts AE2 ender dust in `forge:dusts/ender` as well, preserving Ender IO recipe inputs; both tags prefer AE2. AE2 15.4.10 has no ordinary quartz dust; Ender IO quartz powder and AE2 certus quartz dust remain separate.
- Unification priorities (Almost Unified): vanilla and Create precede All the Ores, which takes priority over later metal providers; explicit owners are AE2 for silicon/ender dust and Ice and Fire for wither bones. BHC wither bone drops are disabled (`boneDropRate = 0.0` in `config/bhc-common.toml`). Zinc worldgen is explicitly All the Ores as requested, but the existing unification list still prefers Create zinc; changing that broader policy is outside this cleanup.
- FTB Essentials defaults ship in `defaultconfigs/ftbessentials-server.snbt`: three homes; 60-second cooldowns for home/back/spawn/tpa; RTP disabled. Fly/god/heal/feed/extinguish/speed remain operator-only (level 2), enforced by the installed mod. For an existing world, merge these settings into `<world>/serverconfig/ftbessentials.snbt` while stopped; the default filename and world filename differ.
- AE2's native REI plugin honors both facade viewer switches, so no facade filter is needed. The duplicate mod-name finding was not confirmed: REI 12.1.785 preserves an existing final mod-name line and removes matching earlier lines before appending. Jade and REI tooltip settings remain enabled; disabling REI's switch would also remove matching labels in its viewer. Crafting Tweaks and Ars Nouveau hide their recipe-book buttons.
- REI manual filters hide 20 confirmed creative-only item IDs and 654 AllTheCompressed 4x-9x items using serialized item stacks. Lower compression tiers and ordinary building variants remain visible; recipes and item availability are unchanged.
- RFTools Storage, Additional Enchanted Miner (QuarryPlus), RFTools Power and Soul Shards are removed after checking required dependencies in every installed jar (including nested mod jars). Their now-unused PolyLib and Scalable Cat's Force libraries are also removed; the Scala loader was used only by QuarryPlus. RFTools Builder, Base and the other RFTools modules stayed until the 2026-10-28 trim removed them (see docs/DECISIONS.md).
- Before updating an existing world, back it up and migrate storage contents, machines, power connections and stored souls from the removed mods. Their blocks/items and associated contents will disappear when the world is loaded without them. Stop the game/server before updating configs and restart afterward.
- Orphan cleanup removes 192 config files, including 26 backups, after comparing owners with the installed mod IDs (including bundled libraries). Present core/library configs, Flywheel bundled with Create, Radium's `lithium.properties`, Polymorph integrations and compatibility definitions owned by active mods are retained. `config/metadata.json` is old FTB pack metadata with an unconfirmed consumer and is left for separate review.
- Ender IO REI clutter: 708 coloured and pass-through/collision clear glass and fused quartz items are hidden by item ID (plain, Enlightened `_e` and Dark `_d` variants stay visible), and two REI search rules (`*filled_soul_vial`, `*broken_spawner`) hide the per-mob Filled Soul Vial and Broken Spawner variants, and two REI show rules (`... #zombie -#villager -#horse`, matched on the mob name in the tooltip) re-show only the Zombie example of each; REI applies `filteringRules` from the bottom of the list upwards (earlier entries win), so the show rules must sit above the hide rules; the Empty Soul Vial stays. Powered Spawner is untouched: Ender IO 6.0.23 registers no per-mob Powered Spawner entries. Recipes and item availability are unchanged.
- Further REI clutter, hidden from the item list only (recipes and items are unchanged): two search rules (`*spawn_egg`, `@dramaticdoors`) hide every spawn egg whose ID contains `spawn_egg` (215 across Alex's Mobs, Alex's Caves, Ice and Fire, L_Ender's Cataclysm, Productive Bees including the NBT `spawn_egg_configurable_bee`, plus the other mods' eggs and vanilla's) and all 1,147 Dramatic Doors items; 16 MineColonies raider/pirate/pharaoh eggs, which lack `spawn_` in their ID, are hidden by item ID. 361 colour variants are hidden by item ID (a separate list from the 16 MineColonies eggs; the earlier "377" counted both): AE2 covered, smart, dense, dense-smart and glass cables in 16 colours (80; fluix cables stay), AE2 coloured and lumen paint balls (30; white paint ball and white lumen paint ball stay), 112 Connected Glass blocks and panes (clear, borderless, scratched and tinted-borderless; the uncoloured ones stay), Supplementaries presents, trapped presents and candle holders in 16 colours (the uncoloured `present`, `trapped_present` and `candle_holder` stay, as do the soul and spectacle candle holders) and 15 flags (white flag stays), Create toolboxes (brown stays), valve handles (copper stays) and seats (red stays), and Alex's Caves radon lamps and rock candy (white stays).
- KubeJS and Rhino were added only for the CLEAN/ALL button on container and inventory screens. It is "EMI: CLEAN / EMI: ALL" (`kubejs/client_scripts/emi_curation/`; it replaced the earlier REI button): CLEAN hides the curated items from EMI's index and, like REI's display filtering, hides recipe displays in which some input or output has every alternative hidden (catalysts and empty slots never count); ALL restores EMI's ordinary index and full recipe set without an EMI reload. Nothing is written to EMI's config, the filters are restored on logout, and a fresh launch always starts clean.
