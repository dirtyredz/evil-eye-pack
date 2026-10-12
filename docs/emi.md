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
  - every Filled Soul Vial and Broken Spawner, except exactly one canonical Zombie stack of each.
- CLEAN also hides recipe displays the way REI's "filter displays" option did. A display is hidden when some input or output has *all* of its alternatives hidden. Catalysts and empty slots never hide a display.
- **EMI: ALL** restores EMI's ordinary index and its complete recipe set without an EMI reload. Recipes, items and EMI's own hidden-stack settings, favorites and config are never written.
- The button sits beside the centred search bar on container and inventory screens. It moves aside for EMI's sidebars and buttons. It disappears with Ctrl+O and is inactive (`EMI: ...`) while EMI loads.
- `EMI: ERROR` means applying a view failed and the last complete view was kept. Click it to retry. `EMI: N/A` means the curation files could not be read. Check `logs/kubejs/client.log` for `EMI curation`.

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
node --test tools/emi_curation/tests/migration.test.cjs tools/emi_curation/tests/policy.test.cjs tools/emi_curation/tests/session.test.cjs tools/emi_curation/tests/emi_config.test.cjs tools/emi_curation/tests/class_filter.test.cjs
node --test tools/packwiz/tests/verify_hashes.test.cjs
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
   - **exactly two** Zombie examples (one vial, one broken spawner).
3. Toggle repeatedly, both with an empty search and with a search typed. ALL must bring back the hidden items and their recipe displays. CLEAN must hide them again. There should be no "EMI reloading" step.
4. Check the display rule in CLEAN. A recipe whose only input or output is hidden disappears. A recipe where a hidden item is only one alternative, or only a catalyst, stays. ALL shows everything.
5. Check every row of the coverage table. Pay most attention to:
   - MineColonies workers, Productive Bees, Ender IO machines and Create processing;
   - AE2: is Certus Growth information present?;
   - Ars, HammerMicroblocks, RFTools and JEP workstations.
6. Test recipe transfer (the `+` fill button), Polymorph recipe selection, clickable recipe arrows, favorites, fluids and NBT ingredients.
7. Test these screens and situations: inventory, chest, crafting table, an AE2 terminal, Curios, GUI scale 2/3/auto, window resize, the CRAFTABLES page, and Ctrl+O. The button must never cover a control.
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
