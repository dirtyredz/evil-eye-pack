---
id: dk-b1fbcc3d
type: task
created: 2026-10-22
status: done
since: 2026-10-23
area:
priority: P1
rank: n
parent:
fixes: []
blocked_by: []
relates: []
---
# Retire AllTheOres and AllTheCompressed in release 1

Release-1 migration was implemented in e10fcaa and aff4d7d, merged locally and never pushed. The owner tested the auto-swap and found it only converted some items.

Disposition, 2026-10-23: migration abandoned by explicit owner decision. No fix, conversion, swap or remap is requested or shipped. All remaining AllTheOres/AllTheCompressed items and placed/unmined blocks are accepted losses. The release-1 scripts, manifest, 31 worldgen overrides, 29 loot overrides and tools/tests were removed with dk-498acdeb. Permanent Large Ore Deposits survivor configuration remains.

The former smoke blocker is assessed against the owner-supplied baseline: final dedup-remove smoke reaches Done with zero KubeJS errors and exactly the same 15 Cozy Cafe/Thirst/AstikorCarts error groups as main; no new groups. The global smoke allowlist was not changed. This item is closed as abandoned migration, not as a successful player migration. See docs/ato-retirement.md and the 2026-10-23-dedup-remove job artifacts.
