# Decisions

Newest first.

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
- The five item lists are split from the frozen REI config (`tools/emi_curation/fixtures/rei-config.json5`). `migrate_rei.cjs --check` enforces exact set equality, 1,759 IDs. The lists are not regenerated from naming patterns.
- The README's old "377 colour variants" figure was 361 colour variants plus 16 MineColonies eggs.
- Tooling is Node-only: migration check, tests, hash verifier, index rebuild and localhost server. The planned `py -3.11` scripts were ported because this machine has no `py` launcher or system Python, and Node is needed for the KubeJS tests anyway.
