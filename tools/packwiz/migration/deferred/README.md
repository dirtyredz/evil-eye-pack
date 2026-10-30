# Deferred port content (fully restored)

All seven owned ports are integrated as of 2026-10-30. No files or policy entries remain parked.

Ice and Fire CE 2.1.4 restored the configs and silver/sapphire Large Ore Deposits targets.
Copper recipe/loot overrides were regenerated from the pinned CE jar in the 1.21 layout;
the old 1.20 generated copies were removed. Dedup and acquisition policy returned to their
owning files, excluding the removed Myrmex eggs. Witherbone again survives over BHC.

See [migration status](../../../../docs/neoforge-migration.md) and
[duplicate cleanup](../../../../docs/duplicate-cleanup.md). Private forks use local
SHA-256/size pins and the dev/trial loopback installer overlay; family delivery is dk-85261627.

CE also needs Jupiter JSON configs; the restored legacy TOML/biome lists are inert.
See migration status for the applied settings and generation-equivalence follow-up.
