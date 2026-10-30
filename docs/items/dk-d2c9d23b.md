---
id: dk-d2c9d23b
type: task
created: 2026-10-29
status: todo
since: 2026-10-29
area: migration
priority: P2
rank: zzzzzzy
parent: dk-876bc6ca
fixes: []
blocked_by: []
relates: [dk-279913bb]
---
# Dedup Interstellaris silver against Ice and Fire silver when the port returns


Interstellaris 0.6.1 (Phase 7, 2026-10-30) adds silver ore, raw silver, ingot, nugget, dust, plate, wire and block, tagged `c:ores/silver`, `c:raw_materials/silver`, `c:dusts/silver`. While Ice and Fire is a deferred port it is the pack's only silver, so no duplicate group exists yet.

When the Ice and Fire port returns (dk-279913bb), `c:` silver tags will hold both. Pick one survivor per the true-dedup policy (existing worlds hold Ice and Fire silver; Large Ore Deposits' parked `silver.cfg` targets Ice and Fire's ore), retire the other at worldgen, loot, recipes and EMI, and regenerate dedup.

Evidence: boot 7 (`artifacts/evil-eye-pack/jobs/2026-10-30-neoforge-phase7/boots/run-2026-10-30T02-21-28-120Z`) resolved the `create:crushed_raw_silver` and Productive Bees silver baseline entries because Interstellaris now fills the tags.
