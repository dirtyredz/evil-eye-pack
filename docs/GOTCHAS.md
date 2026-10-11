# Gotchas

## Packwiz hashes (no packwiz CLI here)

- Hashes cover **LF bytes**. Git stores and GitHub serves LF (`core.autocrlf=input`, plus `.gitattributes`). A file saved with CRLF or a BOM hashes differently from what the installer downloads.
- `tools/packwiz/rehash.cjs` refuses such files rather than normalizing them, and `verify_hashes.cjs` reports them.
- Order matters. Save the file, rebuild `index.toml` (its sha256 entries), and only then hash the final `index.toml` into `pack.toml`. `rehash.cjs` does both steps in that order.
- Metafile `[download]` hashes describe the **jar bytes**. They are a separate layer from the index hash of the `.pw.toml` file itself. Check jars with `verify_hashes.cjs --jars <dir>`.
- `.packwizignore` keeps `tools/`, `docs/` and `STRUCTURE.md` out of the index. `README.md` and `.structure-review-optout` were already indexed and still are.
- After a push, fetch `https://raw.githubusercontent.com/dirtyredz/evil-eye-pack/<branch>/pack.toml` and check that its index hash matches the local one.

## KubeJS 2001.6.5 / Rhino

- `ForgeEvents` is startup-only. Client scripts register with `MinecraftForge.EVENT_BUS.addListener(...)`.
- Forge listeners survive `/kubejs reload`. Register them once, behind a `global` flag, and dispatch through functions stored in `global` so reloaded code runs. `ClientEvents.*` handlers *are* replaced on reload.
- An uncaught exception in a Forge listener hard-crashes the client with **no crash report**. Wrap every listener, button callback and Java-interface callback in try/catch (`emi_curation/diagnostics.js`).
- Rhino cannot `Array.from` or `for...of` a Java collection. Use index loops (`policy.len`/`policy.at`) or `iterator()`.
- `instanceof` against a `Java.loadClass` class works. `.class` does not.
- Rhino turns a plain JS object into a Java interface proxy when it is assigned to an interface-typed field (used for `EmiRecipeManager`). Overloaded interface methods (`getRecipes()` / `getRecipes(category)`) all reach the same JS function, so branch on `undefined`.
- Every script in `client_scripts/` shares one scope. Top-level `const`s in different files collide, which is why each curation module is an IIFE that publishes onto `global.emiCuration`.
- KubeJS's script class filter denies `java.io`, `java.nio`, most of `java.lang`, `java.net` and `net.minecraftforge.fml`. A denied `Java.loadClass` fails only at runtime (the old REI script's `java.io.StringWriter` stack-trace path never worked). `tools/emi_curation/tests/class_filter.test.cjs` checks every class the curation scripts load.
- KubeJS wraps `CompoundTag` as a map view (`NativeJavaMap`) and NBT lists as list views. Key lookups return unwrapped values, and Java methods (`getId()`, `getAllKeys()`, `get(...)`) still resolve when no key of that name exists. `java_interop.toPlainNbt` relies on that.

## EMI internals (pinned 1.1.24+1.20.1+forge)

- `EmiStackList.filteredStacks` is rebuilt by `bakeFiltered()` on every EMI bake and on every user hide or unhide. The curation session detects this (the list identity changes) and re-applies CLEAN.
- `EmiRecipes.manager` is replaced twice per reload: first by a provisional manager, then by the sorted manager from a background worker. Install views only when `EmiReloadManager.isLoaded()` is true and `EmiRecipes.activeWorker == null`.
- `JemiPlugin` skips JEI categories whose namespace has a native EMI plugin (`ae2`, `almostunified`). AE2's JEI-only Certus Growth category is therefore not shown, and AE2's native EMI plugin uses info recipes instead.
- EMI rewrites `config/emi.css` in full on launch, so the trial copy differs from the indexed file after the first start. EMI's QDCSS parser is regex-based: comments in `emi.css` must not contain `:`, `;`, `{` or `}` (guarded by `tools/emi_curation/tests/emi_config.test.cjs`).
