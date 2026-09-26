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
