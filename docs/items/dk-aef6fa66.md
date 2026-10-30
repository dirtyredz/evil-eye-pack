---
id: dk-aef6fa66
type: idea
created: 2026-10-29
status: dropped
since: 2026-10-30
area: migration
priority: P3
rank: zzzzzzzzt
parent: dk-876bc6ca
fixes: []
blocked_by: []
relates: []
---
# Decide whether Mekanism teleporters stay disabled under Interstellaris


Interstellaris 0.6.1 ships `data/mekanism/recipe/teleporter.json` and `portable_teleporter.json` with `neoforge:false`, so neither Mekanism teleporter is craftable (travel goes through its rockets). The pack keeps that design: pack-test policy excludes `mekanism:portable_teleporter` with this reason. If the owner wants teleporters back, a `kubejs/data/mekanism/recipe/` override restoring Mekanism's own recipes is the narrow fix.
