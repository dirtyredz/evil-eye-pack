# Duplicate cleanup

Owner decision, 2026-10-23: abandon release 1 after the partial in-game auto-swap.
AllTheOres, AllTheCompressed and Almost Unified are removed. **Every remaining item,
placed block and unmined ore from the first two mods is lost.** There is no conversion,
swap, unpacking window or registry remap. The old migration implementation remains in git history only.

## Survivors

| Group | Survivor | Removal |
|---|---|---|
| Zinc, brass, copper nuggets, iron/copper/gold/brass sheets | Create | AllTheOres jar removed; Ice and Fire nugget recipes/loot and shared tags use Create |
| Silver and sapphire | Ice and Fire | AllTheOres jar removed; Large Ore Deposits uses explicit I&F ores |
| Uranium | Extreme Reactors yellorium | Explicit deposit ores; Alex's Caves raw uranium remains a biome-specific exception and smelts/blasts to yellorium; ER raw uranium also satisfies its machine tag |
| Electrum, metal rods, zinc/electrum sheets, diamond grit | Crafts & Additions | AllTheOres removed; Create Deco zinc sheet recipe removed and internal plate tag supplied by Crafts & Additions |
| Iron gears | Ender IO | All seven HammerLib gear recipes and dynamic tags disabled; no copper/gold/diamond gear replacements are needed |
| Metal dusts | Ender IO | AllTheOres removed |
| Silicon / ender dust | AE2 | Ender IO SAG outputs and downstream inputs rewritten; counts/chances retained |
| Obsidian dust | Create | Ender IO SAG output rewritten |
| Wither bone | Ice and Fire | BHC's Java drop stays disabled by its existing zero drop rate; survivor supplies the canister ingredient tag |
| Wheat flour / dough / milk bottle | Create / Farmer's Delight / Farmer's Delight | Refurbished flour/dough recipes removed, pizzas rewritten; Create dough outputs and uses rewritten; Productive Bees bottler and bottle consumers rewritten |
| Willow wood family (17 registered duplicates) | Biomes O' Plenty | Cluttered recipes removed, furniture inputs and sapling-chest/block drops rewritten |
| Andesite/brass/copper bars and doors; industrial iron windows/panes | Create | Eight Create Deco producers removed, consumers/loot/tags rewritten |
| Placeable rope | Supplementaries | Farmer's Delight recipes, loot and safety-net/fence inputs rewritten; Supplementaries loot replacement enabled |
| General rotation wrench | Create | HammerLib recipe/tag switch off; Supplementaries wrench recipe removed |

The canonical explicit duplicate IDs are in [dedup.json](../kubejs/config/dedup.json).
[dedup_sources.json](../kubejs/config/dedup_sources.json) records removed recipe IDs and
inherited tags. `tools/dedup/overrides.cjs` computes the block-only strip list,
derived from the scanned block loot tables and written by the generator as `dedup_sources.json` `blockTagRemovals` (`dedup.json` stays hand-authored); `dedup.js` reads it
through KubeJS `JsonIO`. `server_scripts/uranium.js` owns the four uranium
compatibility recipes with their original IDs and KubeJS cooking defaults. These are recipe/loot/tag rules, **not a stack conversion map**.

## Scope and deliberate exceptions

- Remaining mods still register their old copies. They are removed from production recipes,
  loot and shared tags, and permanently hidden in EMI (including ALL). Existing inventory
  stacks and placed blocks are not swept or converted; creative/commands can still obtain
  registered copies. Existing Cluttered saplings can still grow its tree, and mod-specific
  interactions with old placed blocks can still produce their registered variants.
- Refurbished Furniture's wrench operates electrical links (confirmed in its pinned
  WrenchItem bytecode). AE2, Ender IO and Extreme Reactors tools retain their
  machine-specific functions. Create's rope pulley is a machine, not another placeable rope.
- Refurbished Furniture has no registered milk item in 1.0.20 (its milk is a fluid/lang
  entry). No dangling item reference or fake replacement is shipped. Its knife/board remain
  functional decor alongside Farmer's Delight, as permitted by the audit.
- Flowering willow and Cluttered's unique furniture/windows are aesthetic variants, not
  duplicate BOP registry counterparts. Their ordinary willow inputs/drops use BOP.
  Create Deco's overlays, trapdoors, locked doors, other metals and unique windows remain.
- Same-name lanterns, furniture, cushions, limestone, gingerbread bricks and stone tiles are
  decor variety. Alex's Caves amber and Productive Bees amber have different fossil/bee
  mechanics. Create and Productive Bees honey buckets belong to separate fluid registries;
  generic recipe replacement cannot stop a fluid's native bucket filling. They remain.
- Productive Bees specialized honeycomb storage blocks are not vanilla honeycomb blocks.
  The guard allows that exact namespace pair and the uranium exception, with reasons.
- Six unused Create crushed metals (tin, lead, nickel, aluminum, osmium, platinum) are hidden.
  Crushed silver retains its native I&F smelting recipe. Crushed uranium gains yellorium
  smelting/blasting, so productive-bee uranium processing still has an output.

## Permanent files and maintenance

Large Ore Deposits retains release 1's explicit gold/zinc/silver/sapphire/yellorite targets
and disabled aluminum/iridium/lead/nickel/osmium/platinum/ruby deposits. No removed-mod
worldgen or loot override remains.

Config switches cover HammerLib and BHC; KubeJS removes producer recipes and cleans both
item/block tags. Datapack overrides retain each original custom serializer, quantity,
probability and condition. Ice and Fire's tag-selected nugget drops use the cleaned copper
tag; its copper-pile block loot uses Create nuggets. EMI uses native index removals rather
than the cosmetic CLEAN list, so toggling ALL cannot reveal retired duplicates.

When a pinned jar changes, run the offline generator, review its diff, and run the fast gate
in [development](development.md). The guard scans only filenames/hashes pinned by this
branch, resolves nested material tags and applies shipped tag changes; a new duplicate
group or namespace fails. Cached jars are required; it never downloads or silently skips.

The live server smoke must reach Done with zero KubeJS errors and no additional error groups
relative to the supplied main baseline (15 existing Cozy Cafe, Thirst and AstikorCarts groups).
The owner verifies existing-world behavior and EMI visually; agents never launch a client.
