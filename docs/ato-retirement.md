# AllTheOres retirement: release 1

AllTheOres 2.2.3, AllTheCompressed 3.0.2 and Almost Unified 0.11.0 remain installed for this release. Convert stored items before release 2. **Unconverted stacks, placed blocks and unmined AllTheOres ores will disappear at release 2; the owner accepted that loss.** There is no world remap.

Put one old AllTheOres item in a crafting grid to obtain one survivor. The [explicit map](../kubejs/config/ato_retirement.json) covers **71 items**: Create zinc/brass and sheets, Ice and Fire silver/sapphire, Crafts & Additions electrum/rods/sheets/diamond grit, Extreme Reactors yellorium, Ender IO dusts/iron gear, vanilla ores, and HammerLib copper/gold/diamond gears (those gears remain installed). Tin dust has an Ender IO equivalent even though tin ingots do not.

All 31 AllTheOres biome modifiers are disabled through `kubejs/data/alltheores/forge/biome_modifier/`: this jar registers no config switch. Large Ore Deposits now uses explicit surviving zinc, silver, uranium, sapphire and vanilla gold ores; its eight AllTheOres-only deposits are disabled. The gold tag also contained `alltheores:other_gold_ore`, an entry missed by the seam audit. Other deposits were checked and retained. Existing surviving ore variants and raw blocks use 29 loot overrides; Silk Touch yields the surviving ore, ordinary mining yields its raw material/gem, and Fortune/explosion functions are retained.

AllTheOres and all nine compressed tiers remain visible in EMI. Almost Unified still unifies recipes, with explicit silver/electrum/uranium priorities and migration recipes excluded from both unification and deduplication. Its only auto-hide toggle is global, so other duplicates also temporarily become visible.

## Compressed blocks

There are **no other compressed-block equivalents** in this pack: no material-preserving one-to-one compressed conversion exists. Keep the native recipes: one tier-N block unpacks to nine tier-(N-1) blocks, down to nine base blocks at tier 1; convert an AllTheOres base block afterwards if needed. This preserves the stored `9^N` base blocks. 75 material families can reach surviving base blocks. 34 have no surviving base block. No lossy 1:1-to-uncompressed recipe is added.

## Every item without a one-to-one survivor

**AllTheOres: 179 registered items.** Prefix every path in this table with `alltheores:`. These have no conversion (even when another form of that material does). They disappear at release 2 if still held or placed.

| Family | Exact item paths |
|---|---|
| aluminum | `aluminum_block`, `aluminum_dust`, `aluminum_gear`, `aluminum_ingot`, `aluminum_nugget`, `aluminum_ore`, `aluminum_plate`, `aluminum_rod`, `deepslate_aluminum_ore`, `end_aluminum_ore`, `nether_aluminum_ore`, `other_aluminum_ore`, `raw_aluminum`, `raw_aluminum_block` |
| brass | `brass_dust`, `brass_gear` |
| bronze | `bronze_block`, `bronze_dust`, `bronze_gear`, `bronze_ingot`, `bronze_nugget`, `bronze_ore_hammer`, `bronze_plate`, `bronze_rod` |
| constantan | `constantan_block`, `constantan_dust`, `constantan_gear`, `constantan_ingot`, `constantan_nugget`, `constantan_plate`, `constantan_rod` |
| copper | `copper_ore_hammer` |
| iridium | `deepslate_iridium_ore`, `end_iridium_ore`, `iridium_block`, `iridium_dust`, `iridium_gear`, `iridium_ingot`, `iridium_nugget`, `iridium_ore`, `iridium_plate`, `iridium_rod`, `nether_iridium_ore`, `other_iridium_ore`, `raw_iridium`, `raw_iridium_block` |
| lead | `deepslate_lead_ore`, `end_lead_ore`, `lead_block`, `lead_dust`, `lead_gear`, `lead_ingot`, `lead_nugget`, `lead_ore`, `lead_plate`, `lead_rod`, `nether_lead_ore`, `other_lead_ore`, `raw_lead`, `raw_lead_block` |
| nickel | `deepslate_nickel_ore`, `end_nickel_ore`, `nether_nickel_ore`, `nickel_block`, `nickel_dust`, `nickel_gear`, `nickel_ingot`, `nickel_nugget`, `nickel_ore`, `nickel_plate`, `nickel_rod`, `other_nickel_ore`, `raw_nickel`, `raw_nickel_block` |
| osmium | `deepslate_osmium_ore`, `end_osmium_ore`, `nether_osmium_ore`, `osmium_block`, `osmium_dust`, `osmium_gear`, `osmium_ingot`, `osmium_nugget`, `osmium_ore`, `osmium_plate`, `osmium_rod`, `other_osmium_ore`, `raw_osmium`, `raw_osmium_block` |
| peridot | `deepslate_peridot_ore`, `peridot`, `peridot_block`, `peridot_dust`, `peridot_ore` |
| platinum | `deepslate_platinum_ore`, `end_platinum_ore`, `nether_platinum_ore`, `other_platinum_ore`, `platinum_block`, `platinum_dust`, `platinum_gear`, `platinum_ingot`, `platinum_nugget`, `platinum_ore`, `platinum_ore_hammer`, `platinum_plate`, `platinum_rod`, `raw_platinum`, `raw_platinum_block` |
| ruby | `deepslate_ruby_ore`, `ruby`, `ruby_block`, `ruby_dust`, `ruby_ore` |
| tin | `deepslate_tin_ore`, `end_tin_ore`, `nether_tin_ore`, `other_tin_ore`, `raw_tin`, `raw_tin_block`, `tin_block`, `tin_gear`, `tin_ingot`, `tin_nugget`, `tin_ore`, `tin_plate`, `tin_rod` |
| diamond | `diamond_plate`, `diamond_rod` |
| electrum | `electrum_dust`, `electrum_gear` |
| enderium | `enderium_block`, `enderium_dust`, `enderium_gear`, `enderium_ingot`, `enderium_nugget`, `enderium_plate`, `enderium_rod` |
| invar | `invar_block`, `invar_dust`, `invar_gear`, `invar_ingot`, `invar_nugget`, `invar_ore_hammer`, `invar_plate`, `invar_rod` |
| iron | `iron_ore_hammer` |
| lumium | `lumium_block`, `lumium_dust`, `lumium_gear`, `lumium_ingot`, `lumium_nugget`, `lumium_plate`, `lumium_rod` |
| netherite | `netherite_dust` |
| sapphire | `sapphire_dust` |
| signalum | `signalum_block`, `signalum_dust`, `signalum_gear`, `signalum_ingot`, `signalum_nugget`, `signalum_plate`, `signalum_rod` |
| silver | `silver_dust`, `silver_gear`, `silver_plate`, `silver_rod` |
| steel | `steel_block`, `steel_dust`, `steel_gear`, `steel_ingot`, `steel_nugget`, `steel_plate`, `steel_rod` |
| uranium | `uranium_gear`, `uranium_plate`, `uranium_rod` |
| zinc | `zinc_dust`, `zinc_gear`, `zinc_rod` |

**AllTheCompressed: 981 registered items.** For **every** base below, the exact IDs are `allthecompressed:<base>_1x`, `_2x`, `_3x`, `_4x`, `_5x`, `_6x`, `_7x`, `_8x`, `_9x`. This finite expansion lists all 109 × 9 IDs, including blocks from absent mods. All disappear if left compressed at release 2.

| Base-block outcome after unpacking | Bases (each has all nine tiers) |
|---|---|
| No surviving base block | `allthemodium_block`, `aluminum_block`, `ancient_log_0`, `ancient_stone`, `atm_star_block`, `blaze_block`, `blazing_crystal_block`, `bronze_block` |
| continued | `constantan_block`, `ender_pearl_block`, `enderium_block`, `energized_steel_block`, `invar_block`, `iridium_block`, `lead_block`, `lumium_block` |
| continued | `nether_star_block`, `nickel_block`, `niotic_crystal_block`, `nitro_crystal_block`, `osmium_block`, `peridot_block`, `platinum_block`, `ruby_block` |
| continued | `signalum_block`, `spirited_crystal_block`, `steel_block`, `tin_block`, `unobtainium_allthemodium_alloy_block`, `unobtainium_block`, `unobtainium_vibranium_alloy_block`, `uraninite_block` |
| continued | `vibranium_allthemodium_alloy_block`, `vibranium_block` |
| Surviving base block | `acacia_log`, `acacia_planks`, `amethyst_block`, `andesite`, `basalt`, `birch_log`, `birch_planks`, `blackstone` |
| continued | `bone_block`, `calcite`, `clay`, `coal_block`, `cobbled_deepslate`, `cobblestone`, `conductive_alloy_block`, `copper_alloy_block` |
| continued | `copper_block`, `dark_oak_log`, `dark_oak_planks`, `dark_steel_block`, `deepslate`, `diamond_block`, `diorite`, `dirt` |
| continued | `dripstone_block`, `electrum_block`, `emerald_block`, `end_steel_block`, `end_stone`, `energetic_alloy_block`, `flint_block`, `glass` |
| continued | `glowstone`, `gold_block`, `granite`, `grass_block`, `gravel`, `hay_block`, `honey_block`, `iron_block` |
| continued | `jungle_log`, `jungle_planks`, `lapis_block`, `mangrove_log`, `mangrove_planks`, `melon`, `moss_block`, `netherite_block` |
| continued | `netherrack`, `oak_log`, `oak_planks`, `obsidian`, `podzol`, `pulsating_alloy_block`, `pumpkin`, `quartz_block` |
| continued | `red_sand`, `redstone_alloy_block`, `redstone_block`, `sand`, `sapphire_block`, `silver_block`, `snow`, `soul_sand` |
| continued | `soul_soil`, `soularium_block`, `spruce_log`, `spruce_planks`, `stone`, `terracotta`, `tuff`, `uranium_block` |
| continued | `vibrant_alloy_block`, `wax_block`, `zinc_block` |

The jar also contains 44 model-only Mekanism intermediates: for each of `aluminum`, `copper`, `iridium`, `lead`, `nickel`, `osmium`, `platinum`, `silver`, `tin`, `uranium`, `zinc`, the paths `<metal>_clump`, `<metal>_crystal`, `<metal>_shard`, `dirty_<metal>_dust` have no survivor. They are **not registered** without Mekanism, which this pack does not ship, and are excluded from the 250 registered AllTheOres items.

Release-2 cleanup is tracked in [Docket dk-498acdeb](items/dk-498acdeb.md). The other audit duplicates (silicon, flour, Create Deco, etc.) and all other audit seams remain out of scope.
