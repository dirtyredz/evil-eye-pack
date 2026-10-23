---
id: dk-498acdeb
type: task
created: 2026-10-22
status: done
since: 2026-10-23
area:
priority: P2
rank: zzzn
parent:
fixes: []
blocked_by: [dk-b1fbcc3d]
relates: []
---
# Remove AllTheOres, AllTheCompressed and Almost Unified in release 2

Owner scope update, 2026-10-23: abandon the release-1 migration after the owner's partial auto-swap test. Remove AllTheOres, AllTheCompressed and Almost Unified outright, accepting all remaining stacks/placed blocks/unmined ores being lost. No conversion, swap or remap. The owner also explicitly included the seam audit's other duplicate materials in this implementation. This supersedes the earlier migration-window and separate-scope checklist.

Completed on dedup-remove:

- Removed the three mod metafiles, all Almost Unified configs, both migration scripts, shared manifest, all 60 temporary data overrides and tools/ato_retirement. Kept Large Ore Deposits explicit survivors and disabled dead-end ores. No removed namespace references remain in shipped configs/scripts/data.
- Permanent policy covers 38 duplicate IDs, disables all seven HammerLib gears, and hides six unused Create crushed materials. Survivors: Create zinc/brass/sheets/copper nuggets/obsidian dust/bars/doors/windows; I&F silver/sapphire/witherbone; Crafts & Additions electrum/rods/zinc sheet; Ender IO iron gears/metal dusts; AE2 silicon/ender dust; Create flour and FD dough/milk bottles; BOP willow; Supplementaries rope; Create generic wrench.
- 94 source-preserving recipe/loot overrides, 27 removed producer recipes, item/block tag cleanup, permanent EMI removals. Config switches precede data patches where available. No inventory conversion hooks.
- Offline pinned-jar Node guard resolves material tags and rejects new duplicate groups/namespaces. Exact exceptions: Alex's Caves/ER uranium and specialized Productive Bees/vanilla honeycomb storage blocks.
- Deliberate exceptions and limitations are documented in docs/ato-retirement.md: specialty wrenches, decor/function variants, amber mechanics, separate honey-fluid buckets; remaining mods still register old copies and existing inventories/placed blocks are not swept. Refurbished milk is not a registered item in this version.

Verification: 146 Node tests pass; rehash/UTF-8 LF/hash verification and diff checks pass. Final fresh-world offline headless smoke uses 177 hash-verified server jars, reaches Done (94.820 s reported server initialization; 148.501 s process-to-Done), zero KubeJS errors, exactly the baseline's 15 error groups and no new groups. Live probes verify 38 survivor pairs, all 41 inherited item tags, 27 removed recipes and 23,145 loaded recipes without retired item references. Namespace grep only finds Productive Bees' built-in default preference list mentioning alltheores/ato; no removed registry is loaded.

Artifacts: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-23-dedup-remove/ (final-tests.txt, server-final/, smoke-final.txt, smoke-comparison.json). No network downloads, visible client, main-checkout writes, pushes or PR. Existing-world/EMI visual verification remains the owner's manual check.
