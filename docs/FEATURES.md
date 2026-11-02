# Features

Operator-facing pack tooling; mod and recipe coverage remains in the EMI and
duplicate-cleanup guides.

| Feature | Entry point | Documentation |
|---|---|---|
| Offline mod dependency and startup map | `scripts/mod-map/build.ps1` | [Run and interpret the map](development.md#mod-map) |
| Longer days (Evil Eye Tweaks `[time]`, which replaced Hourglass, itself the replacement for the retired Enhanced Celestials/Corgi stack) | `/time query daytime` twice, 20 s apart (about 200 ticks by day, 400 by night) | [Decision](DECISIONS.md#2026-10-27---remove-enhanced-celestials-and-lengthen-days) |
| Reusable operator showcases | `/evileye showcase list` | [Showcases](showcases.md) |
| Contraption storage display | `/evileye showcase contraption_storage` | [Layout](showcases.md#storage-section-layout) |
| Roundwood 0.17.0 doors, windows, archways and trim (NeoForge; legacy variants hidden in CLEAN) | `/roundwood showcase` (operator player) | [Native showcase](showcases.md#roundwood-native-showcase) |
| Mekanism power and ore processing display (NeoForge branch) | `/evileye showcase mekanism_machines` | [Sections](showcases.md#mekanism-and-interstellaris-sections-neoforge-branch) |
| Interstellaris metals, planet ground and a Sable physics pad (NeoForge branch) | `/evileye showcase interstellaris_space` | [Sections](showcases.md#mekanism-and-interstellaris-sections-neoforge-branch) |
| Evil Eye Essentials commands (homes, warps, /back, tpa, kits, trash can; replaced FTB Essentials) and the inventory sidebar (NeoForge branch) | `/evileye showcase evileye_essentials` | [Sections](showcases.md#evil-eye-essentials-section-neoforge-branch) |
| One-boot showcase acceptance | `node tools/showcase/check.cjs --all` | [Headless checks](showcases.md#run-the-headless-check) |

Private migration trial prelaunch: `node tools/packwiz/install/install_local.cjs --instance <trial/.minecraft>`
([private pins](neoforge-migration.md#private-alex-ports-devtrial-only-2026-10-30)); family delivery remains separate.
