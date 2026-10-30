---
id: dk-67a5b4cf
type: idea
created: 2026-10-29
status: todo
since: 2026-10-29
area: migration
priority: P3
rank: zzzzzzzzn
parent: dk-876bc6ca
fixes: []
blocked_by: []
relates: []
---
# Decide Large Ore Deposits for Mekanism osmium, tin and lead


`config/adlods/Deposits/{osmium,tin,lead}.cfg` are disabled: they were dead ends (no mod provided the ores) and still name 1.20 `#forge:` tags. Mekanism (Phase 7, 2026-10-30) now generates osmium, tin and lead ore itself. Enabling deposits with explicit `mekanism:*_ore` ids, like the enabled iron/copper/uranium deposits, would make them match the rest of the pack. Worldgen choice for the owner; affects new chunks only.
