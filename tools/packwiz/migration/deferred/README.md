# Deferred port content (unshipped)

The seven owned ports (minecraft-mods) have no NeoForge 1.21.1 build yet, so their pins are `defer` in
`../target-lock.json`, and everything the pack shipped for them is parked here, outside the packwiz index
(`tools/` is packwiz-ignored), with each file at its original repo-relative path under `<port>/`.

| Port | Parked here |
|---|---|
| Alex's Caves (`alexscaves/`) | `config/alexscaves-*.toml`, `config/alexscaves_biome_generation/`, the Dragons Plus sandpaper override for its chocolate block, the original `kubejs/server_scripts/uranium.js` (its uranium → yellorium recipes) |
| Alex's Mobs (`alexsmobs/`) | `config/alexsmobs.toml`, `config/alexsmobs/` spawn and mob configs |
| Ars Instrumentum (`ars_instrumentum/`) | `config/ars_instrumentum-client.toml` |
| Ice and Fire (`iceandfire/`) | `config/iceandfire-*.toml`, `config/iceandfire/` biome lists, the generated `kubejs/data/iceandfire/` copper overrides, ADLods `sapphire.cfg` and `silver.cfg` (Ice and Fire ores only) |
| Dank Recipe Transfer, Roundwood, FlatWorldFix | nothing beyond their metafiles (shipped no configs or data) |

Shared files:

- `dedup.json`: the port-dependent dedup policy removed from `kubejs/config/dedup.json` (replacements,
  hidden-only ids with their `hidden_reasons.json` entries, extra tags), plus the temporary policy:
  `bhc:wither_bone` survives while Ice and Fire's `iceandfire:witherbone` is absent.
- `pack-test-baseline.json`: the pack-test baseline findings that name port items.

Inert id lists that only mention port ids (EMI curation lists, Entity Culling, Supplementaries, Chloride)
stay in place: they do nothing without the mod and are needed again when it returns.

**Restoring a port:** add its release pin (direct GitHub URL + sha256, no update table), move its files
back with `git mv`, merge its `dedup.json` and baseline entries back, undo its temporary policy, then
regenerate dedup and rehash.
