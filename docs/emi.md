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
  - 1,759 explicit item IDs: 20 creative-only, 654 compressed, 708 Ender IO glass, 361 colour variants and 16 MineColonies eggs;
  - every ID containing `spawn_egg`;
  - the whole `dramaticdoors` namespace;
  - every Filled Soul Vial and Broken Spawner, except exactly one canonical Zombie stack of each;
  - every RFTools Utility syringe carrying a `mobId` tag (one per mob); the plain syringe stays (`hideWhenNbtHasKey` in `rules.json`).
- NBT rules in `rules.json`: `nbtExceptions` hides every stack of an ID except those whose NBT equals `keepWhenNbtEquals`; `hideWhenNbtHasKey` hides a stack of an ID when its NBT has *any* listed key (the value is never inspected). An ID may appear in only one NBT rule across both types; a repeat fails compile with `duplicate nbt rule id`.
- CLEAN also hides recipe displays the way REI's "filter displays" option did. A display is hidden when some input or output has *all* of its alternatives hidden. Catalysts and empty slots never hide a display.
- **EMI: ALL** restores EMI's ordinary index and its complete recipe set without an EMI reload. Recipes, items and EMI's own hidden-stack settings, favorites and config are never written.
- The button sits beside the centred search bar on container and inventory screens. It moves aside for EMI's sidebars and buttons. It disappears with Ctrl+O and is inactive (`EMI: ...`) while EMI loads.
- `EMI: ERROR` means applying a view failed and the last complete view was kept. Click it to retry. `EMI: N/A` means the curation files could not be read. Check `logs/kubejs/client.log` for `EMI curation`.

### The Mods menu

A **Mods ▾** button (`mods_menu.js`) sits beside the search bar, next to the CLEAN/ALL button (left of CLEAN when there is room, otherwise just right of the search bar). It opens a dropdown of major mods by display name. Choosing one sets EMI's search text to `@<modid>`, exactly as typing it would; choosing the active mod again (marked `>`) or **Clear** empties the search. A click outside the menu or Esc closes it without changing the search (Esc is consumed while the menu is open). The button uses the same placement rules as the CLEAN button (`placement.js`: re-placed every frame, hidden with the EMI overlay or before EMI has laid out, inactive while EMI loads). The dropdown rows are not widgets: the script draws them itself in Forge's `ScreenEvent.Render.Post` (after the screen, EMI's sidebar panels and tooltips, at a high z) and hit-tests them from the mouse-press hook, because widgets added at `Init.Post` are drawn with the screen and EMI's panels paint over them. The menu always stays on screen: it opens upward from a button in the lower half (downward otherwise), uses 12 px rows with each column as wide as its longest label, wraps into extra columns only when the height runs out, and is clamped to the window. Labels are drawn with `drawWordWrap` and widths estimated from vanilla font metrics (`drawString`/`Font.width` are unusable from KubeJS, see GOTCHAS) with an opaque ARGB colour above the fills. While the mouse is over the menu, tooltips from the container and EMI are cancelled (`RenderTooltipEvent.Pre`). The search is set with `EmiScreenManager.search.setValue(...)`, whose responder makes EMI refilter.

**Editing the list:** `config/emi-curation/mods.json` is an array of `{ "label": "Create", "modid": "create" }`, in menu order. The modid is the Forge mod id (the `modId` in the jar's `META-INF/mods.toml`, not the packwiz slug). Entries whose mod is not loaded (`Platform.isLoaded`) are skipped, and malformed or duplicate entries are dropped, so the list may name mods the pack does not always carry. Edit it, rehash, then `/kubejs reload client_scripts` (or relaunch) to see the change. Many entries wrap into extra columns.

### How the scripts apply a view

`session.js` runs on every client tick. Once EMI has finished its reload and recipe worker and a player exists, it **syncs** (compares EMI's current index list and recipe manager with the objects it installed last; anything different is a new EMI generation and becomes the new baseline) and then **applies** the view for the current mode: CLEAN installs the filtered index copy and the display-filtering recipe wrapper, ALL reinstalls the baselines, followed by a search and sidebar refresh. Nothing is applied when nothing changed. `hiding.js` supplies the hide decisions and the views build the objects.

**Restore on failure:** before applying, the session remembers the objects currently installed. If any step throws, it puts those back (each step guarded), keeps the last complete view, sets `EMI: ERROR`, and does not retry until EMI replaces its lists or the owner clicks the button. A failed toggle also returns to the previous mode. On logout the session reinstalls EMI's own objects, but only if ours are still the installed ones, and resets to CLEAN.

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
node tools/emi_curation/migrate_rei.cjs --check
node --test tools/emi_curation/tests/*.cjs
node --test tools/packwiz/tests/*.cjs
node tools/packwiz/verify_hashes.cjs
node tools/packwiz/verify_hashes.cjs --jars <dir with the downloaded jars>
for f in kubejs/client_scripts/emi_curation/*.js; do node --check "$f"; done
git diff --check
```

After editing any pack file, save it as UTF-8 with LF line endings. Then run
`node tools/packwiz/rehash.cjs`, which updates `index.toml` and then the index hash in
`pack.toml`. After the approved push, check the branch-served bytes again (see
[GOTCHAS.md](GOTCHAS.md)).

## 3. Owner's in-game checklist

Record the results in [emi-coverage.md](emi-coverage.md).

1. Launch the disposable world. There should be one viewer (EMI) and one `EMI: CLEAN` button. `logs/latest.log` and `logs/kubejs/client.log` should show no EMI curation, plugin or script errors. The log line `EMI curation: loaded curation (1759 explicit ids)` should appear.
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
   - the plain RFTools syringe is the only syringe.
3. Toggle repeatedly, both with an empty search and with a search typed. ALL must bring back the hidden items and their recipe displays. CLEAN must hide them again. There should be no "EMI reloading" step.
4. Check the display rule in CLEAN. A recipe whose only input or output is hidden disappears. A recipe where a hidden item is only one alternative, or only a catalyst, stays. ALL shows everything.
5. Check every row of the coverage table. Pay most attention to:
   - MineColonies workers, Productive Bees, Ender IO machines and Create processing;
   - AE2: is Certus Growth information present?;
   - Ars, HammerMicroblocks, RFTools and JEP workstations.
6. Test recipe transfer (the `+` fill button), Polymorph recipe selection, clickable recipe arrows, favorites, fluids and NBT ingredients.
7. Test these screens and situations: inventory, chest, crafting table, an AE2 terminal, Curios, GUI scale 2/3/auto, window resize, the CRAFTABLES page, and Ctrl+O. The button must never cover a control.
8a. Mods menu: click **Mods ▾** and pick Applied Energistics 2. The search bar must read `@ae2` and the index must show only AE2 items. Pick it again: the search empties. Pick another mod, then **Clear**. Open the menu and click elsewhere, then open it and press Esc: the search is unchanged and Esc does not close the inventory. Check the button hides with Ctrl+O and never covers a control, and that every listed mod is installed.
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
