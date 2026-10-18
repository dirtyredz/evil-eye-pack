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
- **Worldgen mods can be baked into `level.dat`.** Terralith worlds store the overworld's whole multi-noise biome list inline (`Data.WorldGenSettings.dimensions."minecraft:overworld".generator.biome_source.biomes`). Terralith is therefore kept in the pack and cannot be removed from an existing world. Without the mod the world refuses to open ("Overworld settings missing"). Replacing that `biome_source` with `{type: "minecraft:multi_noise", preset: "minecraft:overworld"}` detaches it (`jobs/2026-10-18-create6/tools/detach_terralith.cjs`, on a backed-up copy only); already-generated Terralith chunks keep their blocks but their biomes fall back.
- **The "Unidentified mapping" list in `latest.log` is the content a world loses** after a removal or rewrite: every registry ID the world knew that no longer exists. Read it before shipping a removal.

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
