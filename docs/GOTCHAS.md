# Gotchas

## Packwiz hashes (no packwiz CLI here)

- Hashes cover **LF bytes**. Git stores and GitHub serves LF (`core.autocrlf=input`, plus `.gitattributes`). A file saved with CRLF or a BOM hashes differently from what the installer downloads.
- A clean `git status` does **not** mean the working tree is LF. On 2026-10-11 the main checkout had 372 CRLF config files that git still reported clean (it compares after conversion). the installer would have read those CRLF bytes and failed the hashes. Check with `git ls-files --eol | grep w/crlf`; fix by deleting those files and `git checkout -- <paths>` (the index copies are LF).
- `tools/packwiz/rehash.cjs` refuses CRLF/BOM files rather than normalizing them, and `verify_hashes.cjs` reports them.
- Order matters. Save the file, rebuild `index.toml` (its sha256 entries), and only then hash the final `index.toml` into `pack.toml`. `rehash.cjs` does both steps in that order.
- Metafile `[download]` hashes describe the **jar bytes**, a separate layer from the index hash of the `.pw.toml` itself. Check jars with `verify_hashes.cjs --jars <dir>`; that checks matching hashes, not that every expected jar is present.
- `.packwizignore` keeps `tools/`, `docs/`, `STRUCTURE.md`, `CLAUDE.md`, `AGENTS.md`, `README.md` and `docket.json` out of the index, so editing them never needs a rehash. (`README.md` was published until 2026-10-12.)
- After a push, fetch `https://raw.githubusercontent.com/dirtyredz/evil-eye-pack/<branch>/pack.toml` and check that its index hash matches the local one.

## Installer and instances

- `.minecraft/packwiz.json` is the installer's record of the files it manages. It is how removed mods and configs get deleted on the next sync. Keep it when copying an instance; deleting it leaves stale jars behind.
- The installer overwrites pack-managed configs on every sync. In-game config changes are lost unless they are copied back into the repo.
- Local instances install straight from the checkout's files (no server) and never rehash. Rehash and verify before every local install, and do not edit files while an install is reading them.
- MultiMC's instance ID is the **folder name**; the display name is `name=` in `instance.cfg`. Renaming the display name does not rename the folder. Rename folders only with MultiMC closed, and update `SelectedInstance` in `multimc.cfg`.

## Mod updates and removals

- **Forge hits a missing class only when the code runs.** A mod compiled against an older API loads, then throws `NoClassDefFoundError` from its compat setup (a deferred task), which leaves mod loading "broken" and crashes the client later with an unrelated-looking NPE. Before a big API bump (Create 0.5 → 6), scan every installed jar's class constants for references the new jar no longer has (`jobs/2026-10-18-create6/tools/createrefs.mjs`).
- **Ender IO below 6.2.11 cannot run with Create 6.** `EnderIO-1.20.1-6.0.23-alpha` calls `com.jozufozu.flywheel.core.virtual.VirtualRenderWorld` (Flywheel 0.6) from `FlywheelCompat.getExistingBlockEntity`, reached from `MachineBlock.getLightEmission`; with Flywheel 1.0 it throws `ClassNotFoundException` during Embeddium chunk meshing, so any chunk holding an Ender IO machine never meshes and the world hangs on "Loading terrain". Ender IO 6.2.11-beta is the first release with Create 6 compatibility (and is incompatible with older Create); the pack pins 6.2.18-beta (latest 1.20.1 build, Modrinth direct URL). The 6.1+/6.2 line reworked conduits, so check old conduit networks in existing worlds. 6.2.18 adds config keys (`machines-common` stirling fuelEfficiency*, aversion capacity/usage; `machines-client` aversionRangeColor) that Forge writes as defaults on first boot; they are copied into `config/enderio/`. Athena/Fusion "model loader not found" errors for Ender IO capacitor-bank and glass models also appear on 6.0.23 and are not caused by the update.
- **Worldgen mods can be baked into `level.dat`.** Terralith worlds store the overworld's whole multi-noise biome list inline (`Data.WorldGenSettings.dimensions."minecraft:overworld".generator.biome_source.biomes`). Terralith is therefore kept in the pack and cannot be removed from an existing world. Without the mod the world refuses to open ("Overworld settings missing"). Replacing that `biome_source` with `{type: "minecraft:multi_noise", preset: "minecraft:overworld"}` detaches it (`jobs/2026-10-18-create6/tools/detach_terralith.cjs`, on a backed-up copy only); already-generated Terralith chunks keep their blocks but their biomes fall back.
- **The "Unidentified mapping" list in `latest.log` is the content a world loses** after a removal or rewrite: every registry ID the world knew that no longer exists. Read it before shipping a removal.

## Server smoke (`tools/server_smoke/`)

- **A mod marked `side = "both"` can still be client-only.** packwiz `-s server` installs every `both` mod, and Forge aborts server boot at the first one that touches client classes. Oculus 1.8.0 (`side = "both"`) crashes the server: `Attempted to load class net/minecraft/client/gui/screens/Screen for invalid dist DEDICATED_SERVER`. Forge reports only the first failing mod and leaves the JVM alive after "Crash report saved", so the smoke stops on that line. Use `--drop <name>` to find the next offender, then fix the metafile's `side`.
- **Known server boot noise** (observed 2026-10-18 on a successful boot, listed in `tools/server_smoke/known_noise.json`): datapack tags, recipes and advancements from alltheores, allthecompressed, dramaticdoors, productivebees and totw_modded that reference mods the pack does not ship (Mekanism and others); Radium probing Minecolonies `BlockHutTownHall` (`RuntimeDistCleaner ... ClientLevel`); Structurize's ModernFix `LazyDataFixer` banner; HammerLib's test recipe extension. Mixin "Error loading class ... ClassNotFoundException" lines are WARN, not errors.
- A boot takes ~3 minutes to `Done (` on this machine (about 200 s server-reported); the JVM exits within a minute of `stop`.

## Worktrees

- Move a linked worktree only with `git worktree move`. An Explorer move breaks the `.git` file link and the main repo's `worktrees/` record; `git worktree prune` would then delete the record.
- Local instance pre-launch commands hold the worktree's path: after `git worktree move`, update the `PreLaunchCommand` in that instance's `instance.cfg` (MultiMC closed).

## KubeJS 2001.6.5 / Rhino

- `ForgeEvents` is startup-only. Client scripts register with `MinecraftForge.EVENT_BUS.addListener(...)`.
- Forge listeners survive `/kubejs reload`. Register them once, behind a `global` flag, and dispatch through functions stored in `global` so reloaded code runs. `ClientEvents.*` handlers *are* replaced on reload.
- An uncaught exception in a Forge listener hard-crashes the client with **no crash report**. Wrap every listener, button callback and Java-interface callback in try/catch (`emi_curation/diagnostics.js`).
- Rhino cannot `Array.from` or `for...of` a Java collection. Use index loops (`collections.len`/`collections.at`) or `iterator()`.
- `instanceof` against a `Java.loadClass` class works. `.class` does not.
- Rhino turns a plain JS object into a Java interface proxy when it is assigned to an interface-typed field (used for `EmiRecipeManager`). Overloaded interface methods (`getRecipes()` / `getRecipes(category)`) all reach the same JS function, so branch on `undefined`.
- Every script in `client_scripts/` shares one scope. Top-level `const`s in different files collide, which is why each curation module is an IIFE that publishes onto `global.emiCuration`.
- KubeJS's script class filter denies `java.io`, `java.nio`, most of `java.lang`, `java.net` and `net.minecraftforge.fml`. A denied `Java.loadClass` fails only at runtime (the old REI script's `java.io.StringWriter` stack-trace path never worked). `tools/emi_curation/tests/class_filter.test.cjs` checks every class the curation scripts load.
- KubeJS wraps `CompoundTag` as a map view (`NativeJavaMap`) and NBT lists as list views. Key lookups return unwrapped values, and Java methods (`getId()`, `getAllKeys()`, `get(...)`) still resolve when no key of that name exists. `java_interop.toPlainNbt` relies on that.

## EMI internals (pinned 1.1.24+1.20.1+forge)

- `EmiStackList.filteredStacks` is rebuilt by `bakeFiltered()` on every EMI bake and on every user hide or unhide. The curation session detects this (the list identity changes) and re-applies CLEAN.
- `EmiRecipes.manager` is replaced twice per reload: first by a provisional manager, then by the sorted manager from a background worker. Install views only when `EmiReloadManager.isLoaded()` is true and `EmiRecipes.activeWorker == null`.
- `JemiPlugin` skips JEI categories whose namespace has a native EMI plugin (`ae2`, `almostunified`). AE2's JEI-only Certus Growth category is therefore not shown, and AE2's native EMI plugin uses info recipes instead.
- EMI rewrites `config/emi.css` in full on launch, so a test instance differs from the indexed file after the first start. EMI's QDCSS parser is regex-based: comments in `emi.css` must not contain `:`, `;`, `{` or `}` (guarded by `tools/emi_curation/tests/emi_config.test.cjs`).

- **Macaw's addons need their sibling Macaw mods.** `mcwbiomesoplenty` ships ~7,000 models whose parents live in `mcwfurnitures`, `mcwroofs`, `mcwstairs`, `mcwtrpdoors` and `mcwpaths` (plus bridges/doors/fences/windows). Without those mods its blocks register but render as the purple/black missing model, with no log error for the missing parents. The five are pinned as direct-URL Modrinth metafiles (no CurseForge ids looked up).

- **Widgets added at `ScreenEvent.Init.Post` are drawn under EMI's sidebar panels.** Anything that must float above EMI (the Mods dropdown) is drawn in `ScreenEvent.Render.Post` and hit-tested from `MouseButtonPressed.Pre`. Fills must be `flush()`ed before text, or the batched text can land under them.
- **`GuiGraphics.drawString` and `Font.width` are unusable from KubeJS 2001.6.5.** Their String/Component/FormattedCharSequence overloads are "ambiguous" by argument type (`InternalError: The choice of Java method GuiGraphics.m_280488_ ... is ambiguous`), and neither SRG names (`m_280488_`) nor explicit signatures (readable or SRG) resolve on these objects (`client.log`: "not found as any of ..."). Use single-overload methods instead: `GuiGraphics.drawWordWrap(Font, FormattedText, x, y, maxWidth, color)` (one method in 1.20.1, `m_280554_`, checked with `javap` on the Forge client jar) with `Component.literal(text)`, and estimate widths from vanilla's default font metrics. Colours are signed ARGB ints (`0xFFFFFFFF | 0`). Do not add a "stop drawing after one failure" switch: it makes the UI unusable.
- **Tooltips from the container and from EMI both pass `RenderTooltipEvent.Pre`** (EMI's `drawTooltip` invokes `GuiGraphics.renderTooltipInternal`). Cancel that event to suppress them under a custom overlay.
- **KubeJS 2001.6.5 loads `client_scripts` subfolders into one pack and sorts it by `// priority:` globally.** `emi_curation/ui/` can therefore hold scripts that must load between scripts in `emi_curation/` (checked in the jar: `KubeJS.loadScripts` walks the tree, `ScriptManager` sorts once, and `client.log` lists scripts as `emi_curation/<name>.js`). Keep priorities unique and descending in dependency order.

- **IPN buttons on Dank Storage:** IPN 1.10.20 ships a built-in Dank hint with stale class names, so it never matched and its buttons overlapped Dank's own C / Sort / S. `buttonHints.*.hide` does NOT hide the sort or move-all buttons (only the profile selector reads it), and hints are looked up by the exact screen class name only (not the menu). `config/inventoryprofilesnext/integrationHints/dankstorage.json` keys `tfar.dankstorage.client.screens.CDankStorageScreen` (the one screen for every tier, dock and portable) and moves the buttons instead: `horizontalOffset` is added to the button's right margin (positive = left). Move-to-player and the sort buttons go +72 (left of Dank's cycle button at x=101, top row); move-to-container goes +20 (left of Dank's S at x=155). Re-check after a Dank Storage update.

- **Dank Recipe Transfer must be installed on both sides** (`side = "both"`). Dank Storage's client-side capability is empty, so the client cannot read a dock's contents by itself: the mod syncs the contents to the client. Without it on the server the button finds nothing; without it on the client there is no button.
- **Dank Recipe Transfer is pinned to mixin targets in JEI 15.62.0.219 and EMI 1.1.24.** Re-check it (and the pack-side smoke) after any JEI, EMI or Dank Storage update. It requires Dank Storage; JEI, EMI and Polymorph are optional.
- **Every rebuild of Dank Recipe Transfer changes the jar hash.** After publishing a new release, update `url`, `filename` and `hash` in `mods/dank-recipe-transfer.pw.toml`, then rehash and verify. A stale hash makes the installer refuse the download.

- **Server smoke can time out before "Preparing spawn area", with a fixed seed.** 2026-10-20, seed 20261020, same checkout: one boot spent 15+ min with the main thread busy in ModernFix `PackResourcesCacheEngine` (data pack resource cache) and never got to spawn prep; the next sat 30 min with the main thread parked and the log silent after "Built tags for registry minecraft:block". Neither reached Done, so the "random seed stalls worldgen" theory is not the whole story. The smoke labels a stall `STALL` only when the log shows "Preparing spawn area" progress; earlier hangs stay `FAIL (timeout)` and the thread dump in `stall-threads.txt` in the run dir is the evidence. Open: dk-6dc6fb94.
