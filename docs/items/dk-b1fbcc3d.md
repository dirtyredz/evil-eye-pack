---
id: dk-b1fbcc3d
type: task
created: 2026-10-22
status: todo
since: 2026-10-22
area:
priority: P1
rank: n
parent:
fixes: []
blocked_by: []
relates: []
---
# Retire AllTheOres and AllTheCompressed in release 1

Keep AllTheOres, AllTheCompressed and Almost Unified installed for a conversion release. Disable AllTheOres generation, redirect surviving ore drops and existing materials, preserve EMI discovery, document every unmapped item, and file the release-2 removal checklist. Verify hashes, focused tests and a clean headless server boot.

Implementation on ato-retire-step1:

- 31 forge:none biome-modifier overrides (AllTheOres 2.2.3 has no config switch), 29 loot overrides, 71 one-to-one conversion recipes, explicit Large Ore Deposits survivor ids including the gold tag missed by the audit, and eight disabled dead-end deposits.
- All retiring items are visible through pack curation; Almost Unified's global auto-hide is off and migration recipes are excluded from unification/deduplication. Silver/electrum/uranium survivor priorities are explicit.
- docs/ato-retirement.md accounts for 250 registered AllTheOres items (71 conversions, 179 without a survivor), 44 unregistered Mekanism model entries and all 981 compressed blocks. No other compressed provider exists; the native 9:1 unpacking chains preserve stored material for 75 families. No lossy compressed-to-base 1:1 recipe was added.
- Release-2 checklist: dk-498acdeb. The mods have not been removed.

Verification: 71 focused/fast tests pass; installed-jar inventory, loot, all active deposit tags and 675 unpacking steps pass; UTF-8 LF and packwiz hashes pass. The final fresh-world headless run reaches Done, verifies the exact inputs/outputs of all 71 conversions and all 675 loaded unpacking steps, and has zero KubeJS script errors.

Remaining gate: tools/server_smoke still returns FAIL for the pre-existing Cozy Cafe malformed kelp_cider menu, Thirst loot referencing absent Brewin' and Chewin'/Farmer's Respite items, and AstikorCarts' missing mixin minVersion. These are already documented in docs/GOTCHAS.md but missing from tools/server_smoke/known_noise.json. They are outside this brief and the allowlist was not changed. Keep this item open until the owner/next task resolves or explicitly accepts that smoke-gate limitation; release the worktree claim when reporting.

Evidence and complete per-item report: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-22-ato-retire-step1/ (server-final/, server-final-result.txt, fast-tests.txt, implementation-report.txt). No visible client, network downloads, pushes or PRs.
