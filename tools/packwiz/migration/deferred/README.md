# Deferred port content (unshipped)

The owned ports (minecraft-mods) without a NeoForge 1.21.1 build yet have `defer` pins in
`../target-lock.json`, and everything the pack shipped for them is parked here, outside the packwiz index
(`tools/` is packwiz-ignored), with each file at its original repo-relative path under `<port>/`.

| Port | Parked here |
|---|---|
| Alex's Caves (`alexscaves/`) | `config/alexscaves-*.toml`, `config/alexscaves_biome_generation/`, the Dragons Plus sandpaper override for its chocolate block, the original `kubejs/server_scripts/uranium.js` (its uranium → yellorium recipes) |
| Alex's Mobs (`alexsmobs/`) | `config/alexsmobs.toml`, `config/alexsmobs/` spawn and mob configs |
| Ars Instrumentum (`ars_instrumentum/`) | `config/ars_instrumentum-client.toml` |
| Ice and Fire (`iceandfire/`) | `config/iceandfire-*.toml`, `config/iceandfire/` biome lists, the generated `kubejs/data/iceandfire/` copper overrides, ADLods `sapphire.cfg` and `silver.cfg` (Ice and Fire ores only) |
| Dank Recipe Transfer, Roundwood, FlatWorldFix | restored 2026-10-30 (0.2.0, 0.17.0 and 1.0.0 pins; they parked nothing) |

Shared files:

- `dedup.json`: the port-dependent dedup policy removed from `kubejs/config/dedup.json` (replacements,
  hidden-only ids with their `hidden_reasons.json` entries, extra tags), plus the temporary policy:
  `bhc:wither_bone` survives while Ice and Fire's `iceandfire:witherbone` is absent.
- `pack-test-baseline.json`: the pack-test baseline findings that name port items.

Inert id lists that only mention port ids (EMI curation lists, Entity Culling, Supplementaries, Chloride)
stay in place: they do nothing without the mod and are needed again when it returns.

**Restoring a port:** change its disposition in `../dispositions.json` from `defer` to `repoint` with a `direct`
target (GitHub release URL + sha256; no update table), run `node tools/packwiz/migrate.mjs resolve` (it re-reads
the source from the commit the lock records) and `apply --write`, move its files
back with `git mv`, merge its `dedup.json` and baseline entries back, undo its temporary policy, then
regenerate dedup and rehash.
