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
| Evil Eye equipment panel (curios, armour, cosmetic armour in one screen; replaced Cosmetic Armor Reworked; NeoForge branch) | `/evileye showcase evileye_equipment` | [Sections](showcases.md#evil-eye-equipment-panel-section-neoforge-branch) |
| Sophisticated Backpacks 3.26.20 + Core 1.5.28 + Create Integration 0.2.3: one large backpack worn in the Curios back slot (tiers copper to netherite, upgrades, mounted on Create contraptions); Dank Storage stays | Craft a Backpack (chest, leather, string); open Curios (G), put it in the Back slot, press B | [Decision](DECISIONS.md#sophisticated-backpacks-2026-11-05) |
| One-boot showcase acceptance | `node tools/testing/showcase/check.cjs --all` | [Headless checks](showcases.md#run-the-headless-check) |

Private migration trial prelaunch: `node tools/packwiz/install/install_local.cjs --instance <trial/.minecraft>`
([private pins](neoforge-migration.md#private-alex-ports-devtrial-only-2026-10-30)); family delivery remains separate.

Inventory subset (Client 0.5.0/Tweaks 0.8.0): two move-all controls on classified vanilla storage, and silent selected-hand/offhand refill with near-break tool swaps. IPN remains for sorting. Dank/modded-storage transfer and full IPN removal are not implemented. See [migration status](neoforge-migration.md#2026-11-02---inventory-runtime-subset).

- **Evil Eye settings and inventory actions:** Client 0.6.1 with Tweaks 0.9.0 and Essentials 0.2.0 provides the owned settings screen/service and one outside-panel rail (to player, to storage, sort, trash). Only applicable actions show; clipped or obstructed rails hide. Inventory effects sit left; operator commands stay in the sidebar. IPN/libIPN are retired.

Client 0.7.0 owns reach-around bridging, continuous placement and creative row/column breaking; [placement] settings and the unbound continuous-building key are in the owned settings/controls screens. Pro Placer leaves; Puzzles Lib remains for Diagonal Fences.

Client 0.7.1 stabilizes the inventory sort rail, consumes each sort guard once and fixes client-side Dank inventory sync. The existing settings and placement behavior remain; Iron Chests support is supplied by the paired 0.8.0/0.10.0 release below.

Client 0.8.0 + Tweaks 0.10.0 repair equipment/settings IMC routing and enable negotiated sorting/transfers for ordinary and trapped Iron Chests through 108 slots (Dirt excluded). Client adds the Interstellaris Ponder null-camera guard, pause-menu settings placement recovery/diagnostics and an optional FPS HUD (off by default). Real Iron Chests and rendered client acceptance remain owner checks.

Client 0.9.0 + Tweaks 0.11.0 add Equipment/Cosmetics/Attributes & Effects tabs, redesigned readable settings and a pause eye logo. FPS choices remain opt-in and use string-backed TOML names. Transfer arrows use click for matching destination items (including components) and Shift-click for ALL through the additive inventory_transfer_v2 capability; empty destinations accept nothing on plain click. See [paired release notes](neoforge-migration.md#stable-feedback-client-090--tweaks-0110-2026-11-03). Rendered UI and paired multiplayer acceptance remain owner checks.

Equipment tabs join the panel frame; Attributes & Effects provides paged attributes and active effects with icons and live durations, and the pause eye follows the active button texture. Client 0.10.1 also themes equipment-slot backgrounds from the active inventory texture, including CozyUI. See [Client slot styling](neoforge-migration.md#client-0101-equipment-slot-styling-2026-11-03).

Client 0.10.2 repaints equipment-panel slot groups like CozyUI (alternating cells, row dividers, rounded group outlines, theme crafting arrow); no Tweaks or config change. See [Client slot grid](neoforge-migration.md#client-0102-slot-grid-2026-11-04).

Client 0.10.3 fixes the 0.10.2 slot grid: flat square cells, truly rounded group outline corners with the outside left clear, and no grey box behind the crafting arrow; no Tweaks or config change. See [Client 0.10.3 slot fix](neoforge-migration.md#client-0103-slot-grid-fix-2026-11-04).

Tweaks 0.11.1 keeps the equipment panel open (it reopens itself) when a slot-granting curio such as the Ender Pouch is equipped or removed; no Client or config change. See [Tweaks 0.11.1](neoforge-migration.md#tweaks-0111-curio-panel-stays-open-2026-11-05).

Client 0.10.4 hides the status-effect overlay on Sophisticated Backpacks, Dank Storage and EnderChests (Ender Bag) screens and moves the trash/action rail below Sophisticated Backpacks' settings tabs; no Tweaks or config change. See [Client 0.10.4 storage screens](neoforge-migration.md#client-0104-storage-screens-2026-11-05).
