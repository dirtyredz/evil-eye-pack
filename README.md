# Evil Eye

A [packwiz](https://packwiz.infra.link/) modpack for Minecraft 1.20.1 (Forge 47.4.10), built from
the "Evil Eye Dev1" MultiMC instance. This repo holds mod/shaderpack metadata and config files only
(no jars are committed) — packwiz downloads the actual mod files from CurseForge/Modrinth on demand.

## What's in it

- 160 mods (metafiles pointing at CurseForge or Modrinth, matched by hash to the exact versions used
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

   (Swap in wherever `packwiz-installer-bootstrap.jar` actually lives, and point the URL at this
   repo's raw `pack.toml` once it's pushed — or a locally-served copy for testing.)
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
- Wither bones are unified onto Ice and Fire's: `config/almostunified/unify.json` adds `iceandfire:witherbone` to `forge:wither_bones` (the tag BHC's red heart canister recipe uses) and makes `iceandfire` the preferred mod for that tag.
- Dragon griefing is set to `2`, which Ice and Fire defines as **no griefing** (not weak-block griefing). Tamed griefing, stuck digging, Cyclops griefing and Sea Serpent griefing are disabled.
- AdLODs iron/copper deposits have half the size (350-700 blocks) and half the frequency (rarity 2040/2904), yielding roughly one quarter of their previous added ore volume. Vanilla ore generation is unchanged. Zinc deposits use `alltheores:zinc_ore`, avoiding the mixed Create/All the Ores tag. These generation changes and rarer Myrmex colonies affect new chunks; the colony cap is now 30.
- Only ender dust is newly unified: Ender IO uses `forge:dusts/ender`, so its `powdered_ender_pearl` is also added to `forge:dusts/ender_pearl`, owned by AE2. The reciprocal tag addition puts AE2 ender dust in `forge:dusts/ender` as well, preserving Ender IO recipe inputs; both tags prefer AE2. AE2 15.4.10 has no ordinary quartz dust; Ender IO quartz powder and AE2 certus quartz dust remain separate.
- Fusion chest loot is disabled because its injected tables contain Fusion bronze/steel ingots instead of the preferred metal variants. Already generated loot is unchanged.
- Unification owners (Almost Unified): `alltheores` for metals (steel, bronze, silver, sapphire, electrum, rods), `ae2` for silicon, `iceandfire` for wither bones; BHC wither bone drops are disabled (`boneDropRate = 0.0` in `config/bhc-common.toml`).
