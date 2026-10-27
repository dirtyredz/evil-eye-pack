# Features

Operator-facing pack tooling; mod and recipe coverage remains in the EMI and
duplicate-cleanup guides.

| Feature | Entry point | Documentation |
|---|---|---|
| Offline mod dependency and startup map | `scripts/mod-map/build.ps1` | [Run and interpret the map](development.md#mod-map) |
| Longer days (Hourglass replaces the retired Enhanced Celestials/Corgi stack) | `/hourglass query timeSpeed` | [Decision](DECISIONS.md#2026-10-27---remove-enhanced-celestials-and-lengthen-days) |
| Reusable operator showcases | `/evileye showcase list` | [Showcases](showcases.md) |
| Contraption storage display | `/evileye showcase contraption_storage` | [Layout](showcases.md#storage-section-layout) |
| Roundwood 0.13.3 doors, windows, archways and trim | `/roundwood showcase` (operator player) | [Native showcase](showcases.md#roundwood-native-showcase) |
| One-boot showcase acceptance | `node tools/showcase/check.cjs --all` | [Headless checks](showcases.md#run-the-headless-check) |
