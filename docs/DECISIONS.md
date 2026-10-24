# Decisions

Newest first.

## 2026-10-23 — Acquisition baseline reviewed item by item (dk-e4cc1e7b)

**Decision.** The 439 `acquisition/no-known-source` entries accepted in bulk were each classified from the mod jar (classes, lang, data). The full table (item, class, mechanism and evidence, action) is `classification.md` in the job folder `artifacts/evil-eye-pack/jobs/2026-10-23-acquisition-review/`.
- **Kept in the baseline (307)** with a per-item reason naming the mechanism: made in Java with no recipe (special-recipe serializers, machine/block-entity output, in-world interactions, rituals, NBT or filled variants, tablets, packages, paint pitchers, presents; 226) or a mob drop, villager/colonist trade, boss or structure loot, loot modifier (81). Policy: a baseline entry says what produces the item, never just "mod code"; a mechanism that could not be confirmed says so in the reason.
- **Hidden (131)** through `dedup.json` `hiddenOnly` (regenerated EMI index): creative-only, icon, render-state and placed-only technical items (106, plus six placed-only encased Create blocks) and items with no source in this pack (18, plus `dankstorage:red_print`, whose jar ships no recipe). Hiding removes them from EMI only. To un-hide an item, remove it from `hiddenOnly` and regenerate.
- **Fixed (1):** `supplementaries:bomb_spiky` was craftable only with lead ingots (or Oreganized), neither in the pack; `kubejs/data/supplementaries/recipes/spiky_bomb_2.json` overrides it with iron ingots (the Oreganized variant's own ingredient).
- **Productive Bees bee types.** `bee_conversion` `result` and `bee_breeding` `offspring` are bee type ids (data-driven NBT on one configurable bee entity), not items. The pack test now recognises them (`tools/pack_test/checks/bees.cjs`), no longer reports `output-unrecognized` for them, and counts the configurable spawn egg as their product for acquisition evidence.

## 2026-10-23 — First pack-test findings: fixed, allowed or hidden (orchestrator rulings, owner away)

**Decision.**
- **Ars Elemental quartz crush.** `ars_elemental:quartz_crush` output the nonexistent `minecraft:nether_quartz`; `kubejs/data/ars_elemental/recipes/quartz_crush.json` overrides it with `minecraft:quartz` (same counts and chances).
- **Allowed duplicate groups** (`tools/dedup/allowed_groups.json`, `liveOnly`): `alexscaves:galena_iron_ore` in `#forge:ores/iron` (a stone-variant iron ore, same material) and `supplementaries:ash_brick` in `#forge:ingots/brick` (a distinct material Supplementaries deliberately tags as a brick). Both reach the tag through Forge's own tags, which the cached-jar test cannot see, so the cached-jar stale check skips `liveOnly` entries and only the live pack test guards them.
- **Removed from a tag.** `cluttered:chiseled_gold_block` is a decor block and must not act as gold storage: `dedup.json` `tagRemovals` (`forge:storage_blocks/gold`) is applied by `kubejs/server_scripts/dedup.js` (`event.remove`) and subtracted in the cached-jar duplicate test.
- **Hidden orphans.** Nineteen items players could see in EMI but never obtain went into `dedup.json` `hiddenOnly` (regenerated `kubejs/assets/emi/index/stacks/dedup.json`): nine Extreme Reactors dusts, `reinforced_reactorfluidport_mekanism_passive`, `enderio:powdered_cobalt`/`powdered_tin`, three Iron Furnaces allthemodium/unobtainium/vibranium upgrades, and four Create items (`chromatic_compound`, `refined_radiance`, `shadow_steel`, `crushed_raw_quicksilver`). Checked in the evidence: the only producers are Thermal pulverizer recipes, Mekanism-gated recipes, `allthemodium`-gated recipes and quicksilver-tag-gated Create crushing, all of which are unloaded because those mods or tags are absent; no loot or worldgen source. The pack test already treats `hiddenOnly` as an expected acquisition exclusion.
- **Create: Dragons Plus sandpaper polishing recipes are static data (2026-10-23).** The mod generates them racily (see GOTCHAS), so boots lost up to 85 of 269 recipes. The three generators are off in `config/create_dragons_plus-common.toml` and the recipes ship in `kubejs/data/create_dragons_plus/recipes/sandpaper_polishing/` under the original ids; `machines.json` no longer marks the type `varies`.
- **KubeJS construction race** is diagnosed, not fixed: see Docket `dk-e9c3d82d` and GOTCHAS.

## 2026-10-23 — Automated pack test: one headless boot, an artifact-only KubeJS probe, exact baselines, ANU by default

**Decision.** `node tools/pack_test/run.cjs` is the agent's acceptance command for pack changes. It boots the checkout once on a hidden Forge dedicated server (no client, no window), and a KubeJS probe in that throwaway server writes the live registries, final tags, every loaded recipe and the results of five scripted crafts. Node then checks recipes, tag/loot/removed-mod references, acquisition coverage, machine recipe types, crafts, the duplicate-material guard on live tags, and log groups, and compares every finding with `tools/pack_test/data/baseline.json`.
- **Probe = KubeJS server scripts copied into the throwaway server only** (`tools/pack_test/probe/`, unshipped). KubeJS already ships, earlier artifact probes worked, and it reaches the live `RecipeManager`, registries and a `FakePlayer` crafting menu. A Forge test mod would add a build and distribution step for no extra reach.
- **Raw data is read by Node, not the probe.** KubeJS's class filter denies `java.io`, so resource streams cannot be read from a script; Node reads the same installed jars (vanilla, Forge, mods, KubeJS data) for conditions, loot references, tag files and worldgen blocks. Precedence is approximated (KubeJS > mods > Forge > vanilla); the log and live state stay authoritative.
- **One boot.** The supervisor waits for `Done` *and* the probe's manifest (run token checked); it never boots twice. Spawn-area generation is the slowest part of a boot and is irrelevant to recipes, so a generated world is cached per mod set and seed (`--fresh-world` regenerates).
- **Exact baselines.** Findings have a stable key (check, code, subject, reference); only `fail` findings can be new; each baseline entry carries a reason. A run writes `baseline-candidate.json` for review and never updates the committed baseline itself. Exit 0 = no new findings, 1 = new findings, 2 = invalid run (incomplete probe, crash, setup or cleanup failure), which a baseline can never absorb.
- **ANU by default.** The run executes on ANU (the LAN test PC) so Valhalla stays free; `--local` runs here, and an unreachable or busy ANU falls back to Valhalla with the reason in the summary. Valhalla stages the pack (incremental `-s server` install), syncs only changed files, starts a detached agent (`Win32_Process.Create`, BelowNormal), and analyses the pulled-back evidence itself, so local and remote verdicts come from the same code.

**Limits.** Server-side only: no EMI rendering or search, textures, keybindings, client mixins or multiplayer sync. Acquisition evidence covers recipes, loot tables, worldgen block drops and block-drop chains; trades, Java-coded drops and in-world conversions (waxing, stripping, bucketing) are invisible, so those items need reasoned policy exclusions or baseline entries. Ingredient checks rely on Forge's ingredient JSON plus the live match count; custom ingredient predicates are only checked for "matches nothing".

## 2026-10-23 — Audit 2 fixes: Dark Steel is the pack's steel, keymap clashes resolved

**Decision.**
- **Steel.** With AllTheOres gone, `forge:ingots/steel` was empty, so Extreme Reactors' 17 `forge:conditional` recipes fell back to their `_alt` versions (iron blocks) and its manual showed 14 missing-recipe pages. `kubejs/config/dedup.json` `extraItemTags` now adds `enderio:dark_steel_ingot` to `forge:ingots/steel` (regenerated into `dedup_sources.json`). ER only reads the ingot tag, so plates, nuggets and blocks are not tagged (the Productive Bees steel comb reads `nuggets/steel` and stays off). This fills an empty tag with one namespace, so the duplicate-material guard needs no exception in `allowed_groups.json`; `pack.test.cjs` pins the entry instead.
- **Willow door.** Cluttered's jar tags `cluttered:willow_door` as a trapdoor; the replacement inherited it. `dedup.json` `tagFixes` (applied in `tools/dedup/overrides.cjs`) maps it to `biomesoplenty:willow_trapdoor` in `minecraft:trapdoors` and `minecraft:wooden_trapdoors`, so regeneration keeps the fix.
- Removed `config/simplecorelib-common.toml` (SimpleCore API left on 10-21). `builtin/towntalk` (MineColonies citizen voice lines) joins `default_packs`, before the overrides folder.
- **Keymap.** Every in-world clash from the audit is gone. Kept: Ars book I, Chloride zoom Z, Tool Belt R, Xaero U, GuideME G, Building Gadgets anchor H, Iris O, Xaero minimap settings Y and settings ], vanilla keys. Moved: Dank Storage construction/pickup to keypad 7/6, AstikorCarts slow/action to right Ctrl/right Alt, Create Jetpack active/hover to 0/Caps Lock, Customizable Player Models gestures to F6. Unbound: MCA skin library, Ender IO probe mode, RFTools next destination, Modern UI zoom (Chloride is the single zoom; Modern UI's would also clash with vanilla's creative hotbar save on C).

**Limits.** Context-limited shares stay (dragon riding R/X, JEI/Ponder GUI keys). Default Options applies only to instances with no saved value, so existing instances need these `key_...` lines removed from `options.txt` (or a manual rebind). Caps Lock and the right modifier keys are unusual bindings chosen because every letter, digit and numpad key was taken.

## 2026-10-23 — Config polish pass: default keymap, Cozy look by default, Crafting Tweaks hotkeys

**Decision.**
- **Default Options** (BlayTheNinth, 18.0.5, client side) ships `config/defaultoptions/keybindings.txt`, a conflict-free default keymap for every mod key that collided in the owner's `options.txt` (C, V, R, K, X, Z, U, M, F7, G). Lines use options.txt syntax (`key_<mapping>:<key>[:<modifier>]`). Vanilla keys, plain movement and inventory stay untouched; the vanilla creative toolbar C/X, the Iris/Create/Railways context keys and the dragon-riding keys (R, X) keep their defaults.
- `config/resourcepackoverrides.json` gets `default_packs` for the Cozy set, in the order the owner tested in the Cozy trial (Fresh Animations, Eat Quiet, Fancy Crops, Better Leaves, New Hearts, CozyUI+, then the `evil-eye-cozy-overrides` folder on top). New Hearts declares pack_format 2, so it gets `force_compatible`. Eat Quiet stays `required`.
- Crafting Tweaks `mode = "HOTKEYS"`: its grid buttons are gone, IPN already sorts (middle mouse) and shows only its move-all button.

**Why / limits.** Packwiz cannot manage `options.txt`. Both Default Options keys and Resource Pack Overrides defaults apply only where the player has no saved value, so existing instances (Stable, Local) need a one-time manual rebind and pack selection. Pixlli (the owner's own 128x pack, not pack-managed) is deliberately left alone: it is not forced off, and fresh instances do not get it. No button overlap between IPN, Curios and Cosmetic Armor could be shown from configs alone (Curios `TOP_LEFT` with 0 offsets, Cosmetic Armor button at 65,67, IPN's sort buttons hidden), so those were not moved.

## 2026-10-23 ? Abandon migration and remove duplicate providers

The owner tested release 1 locally: auto-swap only converted some items. The owner chose outright removal of AllTheOres, AllTheCompressed and Almost Unified, accepting loss of every remaining stack and placed/unmined block. The two-release plan below is superseded; neither release-1 commit had been pushed. No conversion, swap or registry remap is shipped.

Large Ore Deposits keeps its explicit survivors and disabled dead-end deposits. Remaining duplicates use config switches first, then recipe/loot overrides and tag cleanup, with permanent EMI hiding. Ender IO owns iron gears; HammerLib gears are disabled (release 1 incorrectly targeted its copper/gold/diamond gears). [The survivor table](duplicate-cleanup.md) records exceptions and compatibility limits. The cached-jar Node guard rejects new multi-namespace material groups, with narrow documented exceptions.

## 2026-10-22 — Two-release retirement of AllTheOres and AllTheCompressed

**Decision.** Keep AllTheOres, AllTheCompressed and Almost Unified installed in release 1. Stop all new AllTheOres generation, redirect surviving ore drops, and provide literal one-to-one material conversion recipes. Keep retiring items visible so players can find migration recipes. Almost Unified keeps running with survivor priorities and exclusions for the conversion recipes.

**World consequence.** Release 2 removes the mods and the temporary scripts/data. Unconverted stacks and placed/unmined AllTheOres blocks disappear; the owner accepted the loss, so no registry-remap mod is built. The former migration note (now [duplicate cleanup](duplicate-cleanup.md)) enumerated items without a survivor and recorded the compressed-block limitation: there is no other compressed provider, so native 9:1 unpacking preserves material before the base-item conversions. The other seams and duplicates in the audit are separate work.

## 2026-10-21 — Fusion is SuperMartijn642's connected-textures library, not Alexndr's alloy add-on

**Decision.**
- `mods/fusion.pw.toml` pins SuperMartijn642's Fusion 1.2.12 (Modrinth direct URL, sha512). The previous Alexndr/Sinhika "SimpleOres: Fusion" 6.0.0.3, its only dependency SimpleCore API, and `config/fusion-common.toml` are removed. The two mods share mod id `fusion` and cannot coexist.
- 1.2.12 rather than 1.3.16: Connected Glass 1.1.14 references Fusion API classes that 1.3.x no longer has.

**Why.** Connected Glass (and Ender IO glass) need the `fusion:model` loader; the old jar logged 425 "Model loader 'fusion:model' not found" errors. Nothing in the pack (recipes, KubeJS, configs, other jars) referenced the alloy add-on; its only trace was a chest-loot toggle added to suppress its duplicate bronze/steel. Consequence: items such as `fusion:bronze_*`/`steel_*` in existing worlds become unidentified.

## 2026-10-21 — Local decor marks, set in game

**Decision.** A rebindable key (default D, "EMI Curation" controls category, GUI conflict context) cycles the hovered item's local override automatic -> decor -> not decor; Shift does the same for its mod. Marks persist in `config/emi-curation/decor-local.json`, which is not in the pack index and layers above `decor.json` (item marks, then mod marks, then the shipped layers). A malformed file is ignored and never overwritten.

**Why.** Curating decor from a config file means leaving the game and guessing ids; the owner sees the item in front of them. Keeping the marks out of the pack means a packwiz update cannot erase them; folding them into `decor.json` later is an explicit ask.

**Rejected.** Writing to `decor.json` directly (the index would change and the next sync would overwrite it); EMI's own hidden-stack store (that is the user-hide feature and would hide recipes too); a chat command (slower than a key over the item).

## 2026-10-21 — Auto Mods menu and an independent DECOR toggle

**Decision.**
- The Mods menu lists every loaded mod that owns an item in EMI's current index, A-Z by display name. `mods.json` is now only overrides (rename, hide, pin). A dropdown too long for the window is paged, not squeezed.
- DECOR is a second axis beside CLEAN/ALL, not a third CLEAN mode. It removes decor stacks from the index copy only; recipe displays, uses and lookups are never filtered by it. The rules live in `config/emi-curation/decor.json` in three layers (manual exceptions, whole mods, tags).
- It starts SHOWN (`defaultHidden: false`), so the out-of-the-box index and ALL are unchanged. The owner flips the default in `decor.json`.
- Doors and trapdoors are not decor (access and redstone parts); beds and signs are. Joy of Painting is not a decor mod, only its easel and canvases are.

**Why.** A hand-written list always misses newly added mods. With decor as a second axis, ALL still means EMI's ordinary index when DECOR is shown, and decor can be hidden under either CLEAN mode. Keeping recipes intact avoids hiding crafting steps that merely use a decor block.

**Rejected.** A third "CLEAN + no decor" mode (not independent); hiding decor in recipe displays (breaks recipe lookups); a hand-listed decor item set (stale on every mod add).

## 2026-10-20 — Dank Recipe Transfer: owner's standalone mod, hosted as a GitHub release

**Decision.**
- Moving recipe ingredients out of Dank Storage into a crafting grid (JEI/EMI "+" button) is a custom mod, **Dank Recipe Transfer 0.1.0**, not a fork or patch of Sophisticated JEI Index. It is a standalone mod so it follows Dank Storage and the viewers independently and can be rebuilt without touching a third-party jar.
- Custom mods live in the `minecraft-mods` workspace (`C:/Users/dirty/projects/minecraft-mods/mods/DankRecipeTransfer`, repo `dirtyredz/dank-recipe-transfer`) and are published as GitHub releases. The pack installs the release jar through `mods/dank-recipe-transfer.pw.toml`, a direct-URL metafile with a sha256 hash (no `[update]` section), `side = "both"`.

**Why.** The jar must be reachable by the packwiz installer from a public URL; a release asset with a pinned hash is the same trust model as the Modrinth direct-URL metafiles already in the pack.

## 2026-10-18 — Server compatibility smoke is the agent's check; Oculus is client-only

**Decision.**
- `tools/server_smoke/smoke.cjs` (headless Forge 47.4.10 dedicated server, `-s server` install) is how agents verify pack compatibility. The owner verifies the client by hand.
- `tools/server_smoke/known_noise.json` is an allowlist of observed, harmless boot errors. Any error group not in it fails the run, so a new mod's breakage cannot hide as noise; add an entry (with the reason) only after reading the log.
- Oculus is `side = client`: it loads client classes at construction and crashed the dedicated server (`Attempted to load class ...Screen for invalid dist DEDICATED_SERVER`). The smoke passes with it excluded from the server install.

**Why.** A client launch is slow and manual; the server boot catches mod-loading and dist errors in minutes, headless.

## 2026-10-18 — Create 6.0.8 and its add-ons; five mods removed (branch `create6`)

**Decision.**
- Create 0.5.1.j → 6.0.8 (bundles Flywheel 1.0.5, Ponder 1.0.91, Registrate). Crafts & Additions 1.3.3, Steam 'n' Rails 1.7.3 (Create 6 release build), Enchantment Industry 2.5.4b with its required Create: Dragons Plus 1.11.9, Ars Creo 4.3.0. New: Create Deco 2.0.3, Connected 1.2.3, New Age 1.2.0 (bundles ESL), Interiors 0.6.0, Jetpack 4.4.6, Ore Excavation 1.6.6, Hypertubes 0.6.0. All are Modrinth direct-URL metafiles.
- Supplementaries 2.5.21 → 3.1.44 and Moonlight 2.7.2 → 2.16.37. 2.5.21's Create compat references `com.simibubi.create.content.logistics.filter.ItemAttribute`, which Create 6 moved; its deferred setup threw `NoClassDefFoundError`, left mod loading broken and crashed the client. 3.1.44 declares `create [6.0.0,]`.
- The Create, Steam 'n' Rails, Ars Creo and Supplementaries configs are the files the new versions wrote back (Forge/Moonlight config correction): every surviving key keeps its value; removed keys are features that moved to other mods (Supplementaries' wall lanterns, hanging signs, cake/skull/bell tweaks now live in Amendments, which is added below).
- Amendments 2.2.6 (1.20-2.2.6, Modrinth `nJORWvdh`) added to restore the features Supplementaries 3 split out. Its only mandatory mod dependency is Moonlight (`1.20-2.16.0`, met by 2.16.37); Supplementaries (`[1.20-2.8.0,)`) and Flywheel are optional.
- Removed at the owner's request: Bad Wither No Cookie - Reloaded, MrCrayfish's Furniture (Legacy), Mob Despawn Timers and Craft Shack. **Terralith is kept** (owner ruling 2026-10-18; it is baked into existing worlds). **Craft Shack's metafile installs `FallingTree-1.20.1-4.3.4.jar`**, so tree felling goes too. None declared a library dependency, so no library was orphaned. Their configs and Mods menu entries were dropped; Terralith's ForgeEndertech files and Mods menu entry stay.
- **FallingTree re-added standalone (owner request 2026-10-19).** `mods/fallingtree.pw.toml` is FallingTree 1.20.1-4.3.4 (Modrinth `Fb4jn8m6`, the same jar as the CurseForge file Craft Shack installed; side both, since Modrinth lists it server-only with optional client). `config/fallingtree.json` is restored unchanged. Craft Shack itself stays removed.

**How it was checked.** Every installed jar's class constants were scanned for `com/simibubi/create/` references missing from Create 6 and its bundled jars (only Supplementaries 2.5.21 failed), and every mandatory `mods.toml` dependency was resolved against the installed set (scripts in `artifacts/evil-eye-pack/jobs/2026-10-18-create6/tools/`).

**Consequences for existing worlds.**
- **A world created with Terralith does not open without it** ("Overworld settings missing"): `level.dat` stores the overworld's multi-noise biome list inline, ~880 of its entries are `terralith:` biomes. The Stable world's `level.dat` has 890 Terralith references. Detaching the biome list (GOTCHAS) was verified on a copy of the trial world, which then opened and the player joined; the owner chose to keep Terralith, so no migration is needed.
- Enchantment Industry 2.x is a rewrite: the Disenchanter, hyper experience and ink entries are gone and are not remapped. MrCrayfish furniture (about 900 registry entries) and Falling Tree's behaviour disappear.
- Supplementaries' `falling_lantern` (moved to Amendments) disappears.

## 2026-10-16 — How the EMI Mods menu is drawn, filters and measures text

**Decision.**
- **Drawn in `ScreenEvent.Render.Post`, not as widgets.** Only the Mods button is a widget. The dropdown is painted by the script after the screen, EMI's sidebar panels and tooltips, at a high z, and hit-tested from the `MouseButtonPressed.Pre` hook. Tooltips under it are cancelled in `RenderTooltipEvent.Pre`.
- **Filtering calls `EmiScreenManager.search.setValue("@<modid>")`.** `EditBox.setValue` runs the widget's responder, which is the path typing takes, so EMI refilters with no EMI-internal calls and no config writes.
- **Text uses `GuiGraphics.drawWordWrap` and estimated widths.** `drawString` and `Font.width` are never called.

**Why.**
- Widgets added at `Init.Post` are drawn with the screen, and EMI's panels paint over them.
- `setValue` is the one supported entry point that makes EMI refilter.
- In KubeJS 2001.6.5 the `drawString`/`Font.width` overloads are "ambiguous" (`InternalError: The choice of Java method GuiGraphics.m_280488_ ... is ambiguous`), and SRG names and explicit signatures both fail with "not found as any of ..." (`logs/kubejs/client.log`, commits 0360f9f and 25fcb0f). `drawWordWrap(Font, FormattedText, int, int, int, int)` has a single overload in 1.20.1, and the client.log member listing confirmed `drawWordWrap` is exposed. Widths come from vanilla's default-font advances (6 px upper bound), so rows are never narrower than their text. Verified working in game at 295f12a.

**Rejected.** Widgets at `Init.Post` (covered by EMI panels); `Font.width`/`drawString` via SRG or explicit signatures (do not resolve); a "stop drawing after one failure" switch (makes the UI unusable); calling EMI's search internals directly.

**Layout of the scripts.** The UI scripts moved to `emi_curation/ui/` (button, placement, mods_menu, mods_list, mods_text, forge_hooks) to keep the folder under the 12-file cap. KubeJS 2001.6.5 loads `client_scripts` recursively into one pack and sorts the whole pack by `// priority:`, so priorities hold across folders (`KubeJS.loadScripts` uses `Files.walk`; `ScriptManager` sorts once).

## 2026-10-12 — EMI adopted as the pack's recipe viewer

**Decision.** `emi-trial` was merged into `main`. The pack now ships EMI 1.1.24, JEI 15.62.0.219 and Just Enough Professions 3.0.1 (with the KubeJS curation scripts and `config/emi-curation/`) instead of REI, REI Plugin Compatibilities and Roughly Enough Professions. The trial entries below remain the rationale.

**Why.** The owner playtested the trial and approved it. Curation, the CLEAN/ALL button and plugin coverage carried over (`docs/emi-coverage.md`).

**Consequences.**
- Existing instances remove the REI jars and configs on their next sync (via `.minecraft/packwiz.json`). Stored REI favorites are not migrated.
- `docs/emi-trial.md` became `docs/emi.md`. The `emi-trial` worktree and the Evil Eye EMI Trial instance are no longer needed.
- Merged with the Eat Quiet resource pack and Resource Pack Overrides from `main`; `index.toml` and `pack.toml` were regenerated with `rehash.cjs`, not hand-merged.

## 2026-10-11 — Source, experiments, artifacts and instances kept apart

**Decision.**
- The main checkout stays at `projects/evil-eye-pack/`. Experiments are linked worktrees under `projects/worktrees/evil-eye-pack/<name>/`. Job prompts, plans and reports go to `projects/artifacts/evil-eye-pack/jobs/<date-task>/`.
- Each experiment gets its own MultiMC instance. **Evil Eye (Stable)** (folder `Evil Eye Stable`, formerly `Evil Eye Dev1`) installs published `main` and holds the owner's worlds. **Evil Eye Local** installs the main checkout straight from its file path (no server, 2026-10-11). **Evil Eye EMI Trial** installs the `emi-trial` worktree from its file path.
- Generic pack tooling (`tools/packwiz/`, `.gitattributes`, `.packwizignore`) was promoted from `emi-trial` to `main` alone, without the EMI gameplay change.

**Why.** Worktrees isolate source; instances isolate installed jars, installer state, configs and worlds. Fixed ports make it obvious which checkout an instance installs. Loopback HTTP is the workflow packwiz documents for local testing and the repo already had the server; a `file:` URL was not used.

**Rejected.**
- One enclosing directory for source and launcher: more path changes, no better boundaries.
- Plain branch switching for experiments: a running feed would silently serve the other branch.
- Testing in the Stable instance: risks the owner's worlds and installer state.
- Cherry-picking the whole `emi-trial` commit: it would also replace REI on `main`.

## 2026-10-11 — Node-only pack tooling

**Decision.** Hash verification, index rebuild and the localhost pack server are Node 22 scripts under `tools/packwiz/`. There is no packwiz CLI, Python or build step on this machine.

## 2026-10-11 — EMI trial: EMI + JEI + JEP on a separate branch and instance

**Decision.** Trial EMI 1.1.24+1.20.1+forge on `emi-trial`, in a copied MultiMC instance,
alongside JEI 15.62.0.219 and Just Enough Professions 3.0.1. REI, REI Plugin
Compatibilities and Roughly Enough Professions are removed on that branch only. `main`
stays on REI until the owner decides.

**Why.**
- EMI only runs JEI plugins through its JEMI bridge when JEI itself is installed. Most of this pack's integrations are JEI plugins (see `emi-coverage.md`).
- JEI `15.62.0.219` (was `15.20.0.102`, bumped 2026-10-12): Polymorph 0.49.11 declares `jei [15.57.0.207,)` even though the dependency is optional, and Forge enforces the range, so 15.20.0.102 aborted mod loading. 15.62.0.219 is the newest 1.20.1 Forge JEI; EMI (`[15.20.0.0,)`), JEP (`[15.0.0.12,)`), AE2 (`[15.0.0,16.0.0)`), Create Crafts & Additions (`[15.0.0.0,)`) and Almost Unified (`[15.1.0.18,)`) all accept it. Change it only for a demonstrated dependency or API need, and record why.
- REP is REI-only. JEP gives the same profession and workstation displays through JEI.
- REI Plugin Compatibilities also declares mod id `jei`, so it cannot coexist with real JEI.

## 2026-10-11 — Curation as reversible runtime views, not EMI's native removal

**Decision.** Pack curation stays in `config/emi-curation/*.json`. KubeJS client scripts
apply it as in-memory views:
- CLEAN swaps `EmiStackList.filteredStacks` for a filtered immutable copy and installs a JS `EmiRecipeManager` wrapper that filters recipe displays with REI's rule.
- ALL reinstalls EMI's own objects.

**Rejected.**
- EMI's native `assets/emi/index/stacks/*.json` `removed`/`filters`. These change the baked index and cannot be turned off at runtime. `disable: true` also drops recipes and checks catalysts, which REI did not.
- Writing the hide list into EMI's user-hidden stacks. That persists to `emi.json`, mixes pack policy with the owner's own hides, and a toggle would have to save files.
- A custom Forge mod. It would avoid the dependency on EMI internals, but it adds a build and hosting step this config-first pack doesn't have.

**Consequences.**
- The views depend on EMI internals, so EMI is pinned.
- The scripts re-apply after every EMI reload or recipe-worker swap and never wrap their own wrapper.
- A toggle never triggers an EMI reload or any file write.
- In CLEAN, "hidden" for display filtering means hidden by the pack, hidden by the owner in EMI, or removed from EMI's index entirely. This matches REI's manual, basic and tag rules. `index-source: creative-plus-registered` keeps the last case equal to "removed by EMI or a plugin".

## 2026-10-11 — Exact source set for curation; Node-only tooling

**Decision.**
- The five item lists were split once from the frozen REI 12.1.785 config (1,759 IDs; not regenerated from naming patterns). `tools/emi_curation/migrate_rei.cjs`, its `fixtures/rei-config.json5` and `migration.test.cjs` were retired 2026-10-20 (dk-eaeaf6eb, dk-232fd37d): the import was done, `--check` pinned live hand-curated counts so any normal edit broke it, and it re-declared validation that `policy.compile` owns. Ongoing list integrity (schema, id format, duplicates) is `policy.compile`, exercised against the real config by `policy.test.cjs`. The fixture and script are recoverable from git at commit a61035d.
- The README's old "377 colour variants" figure was 361 colour variants plus 16 MineColonies eggs.
- Tooling is Node-only: tests, hash verifier, index rebuild and localhost server. The planned `py -3.11` scripts were ported because this machine has no `py` launcher or system Python, and Node is needed for the KubeJS tests anyway.
