# EMI as the recipe viewer

The pack uses **EMI 1.1.24 + JEI 15.62.0.219 + JEP 3.0.1** in place of REI (adopted 2026-10-12,
after the owner playtested the `emi-trial` branch; see `DECISIONS.md`). It keeps the pack's item
curation and the CLEAN/ALL button.

- Instance, feed and port layout for every checkout: [development.md](development.md).
- Coverage evidence and the in-game results table: [emi-coverage.md](emi-coverage.md).
- The first sync into an existing instance installs EMI/JEI/JEP and removes the REI jars, `config/roughlyenoughitems/` and `kubejs/client_scripts/rei_filter_toggle.js` (through the instance's `.minecraft/packwiz.json`; keep that file). Check `.minecraft/mods` afterwards: `emi-*`, `jei-*` and `JustEnoughProfessions-*` present; `RoughlyEnoughItems-*`, `REIPluginCompatibilities-*` and `RoughlyEnoughProfessions-*` gone.
- Test unpushed changes in **Evil Eye Local** or a trial instance, never in a real save or Stable.

## 1. What changed

| Area | Change |
|---|---|
| Viewer | EMI, with JEI installed so EMI's JEMI bridge loads every JEI plugin. JEI's own overlay is replaced by EMI. |
| Professions | JEP (a JEI plugin) replaces REP (REI-only). |
| Curation | `config/emi-curation/*.json` plus `kubejs/client_scripts/emi_curation/` (see below). |
| Settings | `config/emi.css` (see the mapping below). EMI rewrites this file in full on launch. That is expected. |
| Removed | the three REI metafiles, `config/roughlyenoughitems/` (7 files), `rei_filter_toggle.js` |

### Curation and the button

- CLEAN (the default after every launch and logout) hides these from the index:
  - 1,104 explicit item IDs: 19 creative-only, 708 Ender IO glass, 361 colour variants and 16 MineColonies eggs;
  - every ID containing `spawn_egg`;
  - the whole `dramaticdoors` namespace;
  - every Filled Soul Vial and Broken Spawner, except exactly one canonical Zombie stack of each;
- NBT rules in `rules.json`: `nbtExceptions` hides every stack of an ID except those whose NBT equals `keepWhenNbtEquals`; `hideWhenNbtHasKey` hides a stack of an ID when its NBT has *any* listed key (the value is never inspected); none ship since RFTools left on 2026-10-28. An ID may appear in only one NBT rule across both types; a repeat fails compile with `duplicate nbt exception id` within the keep rules or `duplicate nbt rule id` for the hide-key rules, including cross-type repeats. Both compile into one internal `nbtRules` map; the authored JSON format is unchanged.
- CLEAN also hides recipe displays the way REI's "filter displays" option did. A display is hidden when some input or output has *all* of its alternatives hidden. Catalysts and empty slots never hide a display.
- [Duplicate cleanup](duplicate-cleanup.md) removes the retired mods and permanently removes the remaining duplicate stacks from EMI via `kubejs/assets/emi/index/stacks/dedup.json`. CLEAN/ALL still controls cosmetic curation; ALL does not restore retired duplicates.
- **EMI: ALL** restores EMI's ordinary index and its complete recipe set without an EMI reload. Recipes, items and EMI's own hidden-stack settings, favorites and config are never written.
- The button sits beside the centred search bar on container and inventory screens. It moves aside for EMI's sidebars and buttons. It disappears with Ctrl+O and is inactive (`EMI: ...`) while EMI loads.
- `EMI: ERROR` means applying a view failed and the last complete view was kept. Click it to retry. `EMI: N/A` means the curation files could not be read. Check `logs/kubejs/client.log` for `EMI curation`.

### The Mods menu

A **Mods ▾** button (`ui/mods/mods_menu.js`) sits beside the search bar, next to the CLEAN/ALL button (left of CLEAN when there is room, otherwise just right of the search bar). It opens a dropdown of **every loaded mod that owns at least one item in EMI's current index**, built automatically (`ui/mods/mods_source.js`) and sorted A-Z by display name (case-insensitive; the name comes from `Platform.getInfo(modid).getName()`, the Forge mod list through KubeJS). The list follows what the index shows right now: a mod whose items are all hidden by CLEAN or by DECOR drops out until they are shown again. Libraries with no items never appear, and a new mod needs no config edit. Choosing one sets EMI's search text to `@<modid>`, exactly as typing it would; choosing the active mod again (marked `>`) or **Clear** empties the search. A click outside the menu or Esc closes it without changing the search (Esc is consumed while the menu is open). The button uses the same placement rules as the CLEAN button (`ui/placement.js`: re-placed every frame, hidden with the EMI overlay or before EMI has laid out, inactive while EMI loads). The dropdown rows are not widgets: the script draws them itself in Forge's `ScreenEvent.Render.Post` (after the screen, EMI's sidebar panels and tooltips, at a high z) and hit-tests them from the mouse-press hook, because widgets added at `Init.Post` are drawn with the screen and EMI's panels paint over them. The menu always stays on screen: it opens upward from a button in the lower half (downward otherwise), uses 12 px rows with each column as wide as its longest label, wraps into extra columns only when the height runs out, and is clamped to the window. When the columns would be wider than the window the list is **paged** (`ui/mods/mods_layout.js`): each page holds as many columns as fit, and a `< Prev | Next > n/N` strip sits on the row next to the Mods button (both wrap around; paging keeps the menu open and never touches the search). The dropdown slides sideways rather than cover the CLEAN or DECOR buttons. Labels are drawn with `drawWordWrap` and widths estimated from vanilla font metrics (`drawString`/`Font.width` are unusable from KubeJS, see GOTCHAS) with an opaque ARGB colour above the fills. While the mouse is over the menu, tooltips from the container and EMI are cancelled (`RenderTooltipEvent.Pre`). The search is set with `EmiScreenManager.search.setValue(...)`, whose responder makes EMI refilter.

**Overrides:** `config/emi-curation/mods.json` is `{ "schema": 1, "rename": { "modid": "Label" }, "hide": [ "modid" ], "pin": [ "modid" ] }`. `rename` replaces a display name, `hide` removes a mod from the menu (its items stay in the index), `pin` lists mods first, in the given order, before the A-Z rest. The modid is the Forge mod id (the `modId` in the jar's `META-INF/mods.toml`, not the packwiz slug). Malformed entries are dropped; an unreadable file is logged (`EMI curation: load mods.json`) and the menu runs with no overrides. Edit it, rehash, then relaunch or `/kubejs reload client_scripts`.

### DECOR show/hide

A **DECOR: SHOWN / DECOR: HIDDEN** button (`ui/decor_button.js`) sits right of the Mods button (or the next free spot beside the search bar; the search row needs a window about 430 GUI pixels wide for all three buttons). It is independent of CLEAN/ALL: with DECOR hidden, decor stacks are removed from the index in CLEAN and in ALL alike, and the two buttons combine freely. It only changes the index list, with the same in-memory copy mechanism as CLEAN. **Recipes, uses, lookups and recipe displays are never filtered by DECOR**, and nothing is written to EMI's config, hidden set or persistent data. It persists like CLEAN: kept across `/kubejs reload` and EMI reloads (F3+T), reset to the default on logout and on every launch. The default is `defaultHidden` in `decor.json` (shipped `false`: starts SHOWN; set `true` to start HIDDEN). `DECOR: N/A` means `decor.json` could not be read (CLEAN is unaffected; see `EMI curation: load decor.json` in `logs/kubejs/client.log`).

`config/emi-curation/decor.json` has three layers, checked in this order, first match wins (`decor/decor_policy.js`, pure):

1. **Manual exceptions**: `forceNotDecor` (ids that stay visible), then `forceDecor` (ids that are always decor). Exact `namespace:path` ids.
2. **Whole mods**: `mods` (exact namespaces), `modPrefixes` (namespace starts with, e.g. `mcw` for every Macaw's mod) and `pathPrefixes` (namespace to path prefixes, e.g. `herbalwitch` items whose path starts with `decor/`).
3. **Tags**: `itemTags` and `blockTags`. A block tag matches the block's item (`Block.asItem()`). Tags are read from the live registries (`decor/decor_tags.js`), so modded stairs, slabs, fences and so on that join the common tags are included without being listed. The tag set is built on first use and rebuilt for every new EMI generation.

Shipped contents: decor mods `handcrafted`, `another_furniture` (in no pack instance yet, so its id is unverified), `cluttered`, `domum_ornamentum`, `createdeco`, `interiors`, `roundwood`, `connectedglass`, `friendly_furnishings`, `refurbished_furniture`; prefix `mcw` (Macaw's: mcwbridges, mcwdoors, mcwfurnitures, mcwfences, mcwpaths, mcwstairs, mcwwindows, mcwpaintings, mcwroofs, mcwtrpdoors, mcwbiomesoplenty); and Herbal Witch `decor/`. Tags: stairs, slabs, walls, fences, fence gates, carpets, banners, candles, flower pots, glass panes (`forge:glass_panes`, `forge:stained_glass_panes`), signs and hanging signs, beds. **Not decor (owner call, easy to change): doors and trapdoors.** They are access and redstone parts, and the door families that are mostly variants are already covered (Macaw's by the prefix, Dramatic Doors by CLEAN). To hide them too, add `minecraft:doors` and `minecraft:trapdoors` to `itemTags` and `blockTags`. Joy of Painting is not a decor mod (its palettes and brushes are tools), so only its easel and canvases are in `forceDecor`. Functional items of decor mods are in `forceNotDecor`: Supplementaries' faucet, Domum Ornamentum's architect's cutter, Handcrafted's hammer, Refurbished Furniture's wrench, spatula and TV remote. Hidden decor also drops out of the Mods menu while it is hidden.

#### Marking items as decor in game

Hover an item and press **D** (rebindable: Options > Controls > **EMI Curation** > "Mark hovered item as decor"). Its local override cycles **automatic** (what `decor.json` says) -> **decor** -> **not decor** -> automatic, and a toast shows the new state and the item name. **Shift+D** does the same for the item's **whole mod** (`All of <modid>: decor`). Works on anything EMI reports under the mouse (index, favorites, recipe screens, inventory slots through EMI's providers) and on a vanilla container slot. A tag ingredient (several items) or a fluid gets a hint and no mark. The key is ignored while a text field (the EMI search box, an anvil name) has focus, with Ctrl or Alt held, or when nothing is hovered, so typing and other bindings are unaffected. The index is rebuilt at once with the current CLEAN/ALL and DECOR state (no EMI reload), and the Mods menu follows. If DECOR is SHOWN nothing visibly changes yet: the mark applies when you hide decor.

The marks live in `config/emi-curation/decor-local.json`, created on first use. It is not in the pack index, so a packwiz update never overwrites it. Shape: `{ "schema": 1, "forceDecor": ["ns:id"], "forceNotDecor": ["ns:id"], "mods": ["namespace"], "notMods": ["namespace"] }` (every list optional; an id or namespace may sit in only one list of a pair). Precedence, first match wins: local item marks, then local mod marks, then the shipped `decor.json` layers. An item mark beats a mod mark, so one item can stay visible inside a decor mod. A local `mods` entry also overrides the shipped `forceNotDecor` list for that mod's items that have no item mark. A malformed file is logged once (`EMI curation (load decor-local.json)` in `logs/kubejs/client.log`) and ignored: the shipped rules still work, and marking is refused with a toast so your file is never overwritten. Edit it by hand and run `/kubejs reload client_scripts` to re-read it. To make marks permanent for everyone, ask the agent to **fold the local marks into `decor.json`** (it copies `forceDecor`/`forceNotDecor`/`mods` into the shipped file, rehashes, and you delete the local entries).

The key mapping is a **startup script** (`startup_scripts/emi_curation_keys.js`): a change needs a full game restart, not `/kubejs reload`. Without it the feature is inert and `client.log` says `the "mark as decor" key mapping is missing`.

### How the scripts apply a view

`session.js` runs on every client tick. Once EMI has finished its reload and recipe worker and a player exists, it **syncs** (compares EMI's current index list and recipe manager with the objects it installed last; anything different is a new EMI generation and becomes the new baseline) and then **applies** the view for the current mode: CLEAN installs the filtered index copy and the display-filtering recipe wrapper, ALL reinstalls the baselines, followed by a search and sidebar refresh. The index installed is picked from the CLEAN/ALL x DECOR combination (baseline, or a filtered copy cached per combination until EMI replaces its list); recipes depend on CLEAN/ALL only. Nothing is applied when nothing changed. `hiding.js` supplies the CLEAN (pack policy) hide decisions, `decor/decor_state.js` supplies the DECOR decisions, and the views build the objects.

**Restore on failure:** before applying, the session remembers the objects currently installed. If any step throws, it puts those back (each step guarded), keeps the last complete view, sets `EMI: ERROR`, and does not retry until EMI replaces its lists or the owner clicks the button. A failed toggle also returns to the previous mode. On logout the session reinstalls EMI's own objects, but only if ours are still the installed ones, and resets to CLEAN.

`recipe_view.js` owns the recipe baseline, installed Java proxy, known-wrapper map and reload token in `global.emiCuration.recipeState`. Its `viewFor`/`unwrap` boundary prevents wrapping our own managers; `sync`, `apply`, `invalidate`, `restore`, `release` and `reset` keep that lifecycle out of the session's mode/status logic. Script reloads retain enough identity information to replace old wrappers safely; logout clears it. `hiding.js` holds the single registry-key classification cache, and `policy.verdictHidden` evaluates those verdicts with lazy, per-stack NBT reads.

The CLEAN and DECOR configs use `ui/screen_button.js` for their shared widget lifecycle. Each toolbar widget publishes its visible rect to `ui/placement.js`; Mods and DECOR consume those rects without reading sibling widget holders. Registration priorities still place CLEAN, then Mods, then DECOR each frame. The Mods modules live in `ui/mods/`; folder nesting does not change KubeJS's global priority ordering.

### Settings mapping (REI → EMI)

| REI | EMI (`config/emi.css`) |
|---|---|
| Viewer visible, cheating off | `general.enabled: true`, `general.cheat-mode: false` (off in creative too) |
| Centred search, right entry panel | `ui.center-search-bar: true`, index in the right sidebar |
| Craftable-only button | right sidebar pages `index, craftables` with a visible header. Click the header to switch. |
| Append mod names | `ui.append-mod-id`, `ui.append-item-mod-id`. Check for duplicate labels with Jade. |
| Tooltip search ALWAYS | `general.search-tooltip-by-default: true` |
| Mod/tag search PREFIX | defaults off. Type `@mod`, `#tag` or `$tooltip` in the search bar. |
| R / U / A / Ctrl+O / Backspace / middle-click | `view-recipes`, `view-uses`, `favorite`, `toggle-visibility`, `back`, `copy-recipe-id` keep the same keys, and left/right click on a stack also shows recipes/uses |
| Max recipe page height 300 | `ui.maximum-recipe-screen-height: 300` |
| Entry list = registry + creative stacks | `general.index-source: creative-plus-registered` |
| Favorites | EMI's left sidebar. The two old REI favorites are not migrated: re-add cobbled deepslate with A. The FTB trash-can button was an REI-only favorite, and FTB Library now shows it in its own sidebar. |

AE2's facade switches, the coloured-cable recipe switch and `exposeInventoryToEmi: false`
are unchanged. So are Jade's tooltip settings, the Crafting Tweaks / Ars Nouveau
recipe-book suppression and Stylish Effects' right-side placement.

## 2. Checks to run from the checkout

```
node --test tools/emi_curation/tests/*.cjs
node --test tools/packwiz/tests/*.cjs
node tools/packwiz/verify_hashes.cjs
node tools/packwiz/verify_hashes.cjs --jars <dir with the downloaded jars>
# PowerShell: include every nested client module.
Get-ChildItem kubejs/client_scripts/emi_curation -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Syntax check failed: $_" } }
git diff --check
```

After editing any pack file, save it as UTF-8 with LF line endings. Then run
`node tools/packwiz/rehash.cjs`, which updates `index.toml` and then the index hash in
`pack.toml`. After the approved push, check the branch-served bytes again (see
[GOTCHAS.md](GOTCHAS.md)).

## 3. Owner's in-game checklist

Record the results in [emi-coverage.md](emi-coverage.md).

1. Launch the disposable world. There should be one viewer (EMI) and one `EMI: CLEAN` button. `logs/latest.log` and `logs/kubejs/client.log` should show no EMI curation, plugin or script errors. The log line `EMI curation: loaded curation (1105 explicit ids, decor rules)` should appear.
2. In CLEAN, check every hidden family and its kept base example:
   - fluix cables;
   - white paint balls;
   - uncoloured Connected Glass;
   - the plain present, candle holder and flag;
   - brown toolbox, copper valve handle and red seat;
   - white radon lamp and rock candy;
   - lower compression tiers;
   - plain, `_e` and `_d` Ender IO glass;
   - Empty Soul Vial and Powered Spawner;
   - **exactly two** Zombie examples (one vial, one broken spawner);
3. Toggle repeatedly, both with an empty search and with a search typed. ALL must bring back the hidden items and their recipe displays. CLEAN must hide them again. There should be no "EMI reloading" step.
4. Check the display rule in CLEAN. A recipe whose only input or output is hidden disappears. A recipe where a hidden item is only one alternative, or only a catalyst, stays. ALL shows everything.
5. Check every row of the coverage table. Pay most attention to:
   - MineColonies workers, Productive Bees, Ender IO machines and Create processing;
   - AE2: is Certus Growth information present?;
   - Ars, HammerMicroblocks and JEP workstations.
6. Test recipe transfer (the `+` fill button), Polymorph recipe selection, clickable recipe arrows, favorites, fluids and NBT ingredients.
7. Test these screens and situations: inventory, chest, crafting table, an AE2 terminal, Curios, GUI scale 2/3/auto, window resize, the CRAFTABLES page, and Ctrl+O. The button must never cover a control.
8a. Mods menu: click **Mods ▾**. Every installed mod that adds items must be listed A-Z by its name (spot-check Applied Energistics 2, Create, Supplementaries, Handcrafted and any newly added mod); libraries with no items (Architectury, GeckoLib, Balm) must not appear. Pick a mod: the search bar must read `@<modid>` and the index must show only that mod's items. Pick it again: the search empties. Pick another mod, then **Clear**. Page with **Next >** and **< Prev** (both wrap, the menu stays open, the search is untouched). Open the menu and click elsewhere, then open it and press Esc: the search is unchanged and Esc does not close the inventory. Check the button hides with Ctrl+O, and the dropdown never covers the CLEAN or DECOR buttons or leaves the window, at GUI scale 2, 3 and auto and after resizing the window. Then put `"hide": ["ae2"]` in `mods.json`, rehash, relaunch: AE2 is gone from the menu but its items stay in the index.
8b. DECOR: after launch the button reads `DECOR: SHOWN` and sits right of Mods. Click it: `DECOR: HIDDEN`, and the index loses stairs, slabs, walls, fences, fence gates, carpets, banners, candles, flower pots, glass panes, signs, beds, every Macaw's, Handcrafted, Cluttered, Domum Ornamentum, Create Deco, Create: Interiors, Roundwood, Connected Glass, Friendly Furnishings and Refurbished Furniture item, Herbal Witch `decor/` items, and the Joy of Painting easel and canvases. Still visible: the Supplementaries faucet, Domum's architect's cutter, doors and trapdoors, and the other Herbal Witch items. Press R/U on a recipe that uses a hidden item: its recipes still open. Toggle CLEAN/ALL while DECOR is hidden (decor stays hidden in both; ALL still shows what only CLEAN hides). Type searches (`oak`, `@create`): decor stays hidden. Open the Mods menu: fully-decor mods (Handcrafted, Macaw's) are gone while hidden and return when SHOWN. F3+T and `/kubejs reload client_scripts` keep the DECOR state; logout resets it. `logs/kubejs/client.log` must have no `decor tag` or `load decor.json` errors. If a tag misses modded variants, tell the agent which items: the tag read is the one part not yet seen running in a game.
8c. Mark as decor: options > Controls shows an **EMI Curation** category with "Mark hovered item as decor" on D (change it and back). Hide decor, hover a non-decor item (a Create cog) in the index and press D: a toast reads `cog: decor`, the item leaves the index at once, and `config/emi-curation/decor-local.json` appears listing it under `forceDecor`. Press D twice more (`not decor`, `automatic`). Hover a Macaw's stair, press D until `not decor`: it returns while DECOR stays HIDDEN. Shift+D over a Create item: `All of create: decor`, all of Create leaves the index and the Mods menu; Shift+D again: `not decor`, back. Try the same on a favorite, a recipe-screen ingredient and an inventory slot. D with nothing hovered, with the search box focused (type `d`), and with Ctrl held must do nothing. Check the D key still walks right in the world. Quit, relaunch: the marks persist. Put `{ nope` in the file and relaunch: one `load decor-local.json` error in `client.log`, shipped DECOR still works, and D shows the "malformed" toast without touching the file. Report any hover spot that does not mark.
8. Test `/kubejs reload client_scripts`, F3+T, logout/rejoin and restart:
   - reloads keep the current CLEAN/ALL choice;
   - logout and restart go back to CLEAN;
   - curation persists.
9. Compare REI (an older instance) with EMI under the same conditions: disposable world, JVM settings, shaders and searches. Record:
   - launch-to-ready time;
   - search responsiveness;
   - recipe navigation;
   - memory use.

Acceptance needs no unexplained recipe or category loss. Faster search alone is not
enough.

### Comparison record

| Measure | REI | EMI |
|---|---|---|
| Launch to main menu | | |
| World load to viewer ready | | |
| Search "iron" / "@create" / "#forge:ingots" | | |
| Recipe navigation (R/U on 5 items) | | |
| Memory after 5 min idle | | |
