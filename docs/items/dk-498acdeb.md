---
id: dk-498acdeb
type: task
created: 2026-10-22
status: todo
since: 2026-10-22
area:
priority: P2
rank: zzzn
parent:
fixes: []
blocked_by: [dk-b1fbcc3d]
relates: []
---
# Remove AllTheOres, AllTheCompressed and Almost Unified in release 2


Release 2 follows the release-1 migration window. The owner accepted deletion of remaining AllTheOres/AllTheCompressed stacks and placed blocks, including unmined AllTheOres worldgen. No registry remap is required. Read docs/ato-retirement.md for all dead ends and compressed-block unpacking instructions. Do not include the audit's other duplicates or seams in this task.

Acceptance checklist:

- Confirm release 1 reached players and the conversion/unpacking window is over; have the owner check the real world in game. Work on a disposable world copy for verification, never write to Stable from an agent test.
- Remove mods/ato.pw.toml, mods/allthecompressed.pw.toml and mods/almostunified.pw.toml.
- Delete kubejs/server_scripts/ato_retirement.js and kubejs/config/ato_retirement.json. These recipes reference removed registries and must not survive release 2.
- Delete kubejs/data/alltheores/ in full: 31 forge/biome_modifier/alltheores/*.json overrides and 29 loot_tables/blocks/*.json overrides. Check for any additional release-1 files before deletion.
- Remove config/almostunified/startup.json, unify.json, duplicates.json and debug.json together with Almost Unified. Inspect surviving recipes affected by its existing silicon/wither-bone/ender-dust preferences; any broader duplicate cleanup is separately scoped work.
- Keep the permanent Large Ore Deposits changes: explicit vanilla gold/Create zinc/Ice and Fire silver and sapphire/Extreme Reactors yellorite; aluminum, iridium, lead, nickel, osmium, platinum, ruby and tin deposits disabled. Do not restore old shared tags or AllTheOres ids.
- The old config/emi-curation/compressed.json and its rules.json entry were already removed in release 1 to expose all unpacking recipes. Remove any newly introduced retiring-item visibility rules, but retain unrelated EMI curation.
- Retire tools/ato_retirement/check_installed.cjs and tools/ato_retirement/tests/ (including the pinned catalog), update the affected EMI fixtures/tests and remove their release-1 commands from docs/development.md. Retain permanent no-AllTheOres placement coverage as appropriate for the removed-mod pack.
- Update STRUCTURE.md, docs/ato-retirement.md, docs/emi.md and the living decision/gotcha notes to state that the migration window has ended. Search all shipped files for alltheores/allthecompressed/almostunified; resolve dangling references and orphaned scripts/data.
- Save pack files as UTF-8 LF, run node tools/packwiz/rehash.cjs, node tools/packwiz/verify_hashes.cjs, the documented focused fast gate, and the headless server smoke with a fresh world and no KubeJS script errors. Check known pre-existing Cozy/Thirst smoke errors separately; do not mask new errors.
- Have the owner verify a copy of the existing world: survivor inventories remain, expected missing content is removed, and there are no remaining conversion recipes. Never launch a visible game client as the implementation agent.

Release 1 is tracked by dk-b1fbcc3d. Its job artifacts are under C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-22-ato-retire-step1/.
