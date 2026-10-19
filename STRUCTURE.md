# Structure

A packwiz modpack (Minecraft 1.20.1, Forge 47.4.10). The repository holds packwiz
metadata, configs and client scripts that packwiz installs into an instance. It also holds
unshipped tooling and docs, which `.packwizignore` keeps out of the index.

## Layout

- `pack.toml` — pack definition; its `[index]` hash is sha256 of `index.toml`
- `index.toml` — every installed file with its sha256 (rebuild with `tools/packwiz/rehash.cjs`)
- `mods/` — packwiz metafiles (`*.pw.toml`), one per mod jar (CurseForge or Modrinth)
- `shaderpacks/` — shaderpack metafiles and saved shader options
- `resourcepacks/` — resource pack metafiles (`*.pw.toml`) installed into the instance
- `config/` — mod configs installed as plain files
- `config/emi-curation/` — EMI curation data: `rules.json`, five explicit item lists, and `mods.json` (the Mods menu entries)
- `defaultconfigs/` — Forge default (per-world) configs
- `kubejs/client_scripts/emi_curation/` — client scripts for the curated EMI views (diagnostics, collections, policy, interop, views, hiding, session)
- `kubejs/client_scripts/emi_curation/ui/` — the CLEAN/ALL button, the Mods menu and what they share (placement, Forge listener registration). KubeJS loads subfolders and sorts the whole pack by priority, so folders do not change load order.
- `tools/emi_curation/` — unshipped: REI-to-EMI migration check, Node tests for the curation scripts
- `tools/emi_curation/fixtures/` — frozen REI config the migration check compares against
- `tools/emi_curation/tests/`, `tools/packwiz/tests/`, `tools/server_smoke/tests/` — Node test suites (`node --test tools/packwiz/tests/*.cjs tools/emi_curation/tests/*.cjs tools/server_smoke/tests/*.cjs`)
- `tools/emi_coverage/` — unshipped: read-only jar scanner for viewer plugin coverage
- `tools/server_smoke/` — unshipped: headless Forge server compatibility smoke (`smoke.cjs`), its environment, setup, boot, process, verdict and log-analysis modules, and known boot noise
- `tools/packwiz/` — unshipped: hash-chain verifier, index rebuild, localhost pack server, tests
- `docs/` — unshipped living docs (development workflow, decisions, gotchas, EMI guide and integration coverage)
- `docs/items/`, `docket.json` — Docket work-item store (use `dk`); `AGENTS.md` — agent instructions. All unshipped.

## Components

| Component | Responsibility |
|---|---|
| `tools/packwiz/pack_index.cjs` | index/pack TOML parse and format, `.packwizignore`, byte hashing, `publishableFiles()` (the one publishable-file set used by rehash and verify) |
| `tools/packwiz/rehash.cjs` | rebuild `index.toml` membership and hashes, then `pack.toml`'s index hash |
| `tools/packwiz/verify_hashes.cjs` | check the hash chain, index membership and optionally jar hashes |
| `tools/packwiz/serve.cjs` | serve the containing checkout on `127.0.0.1` over HTTP (not used by MultiMC: local instances install from the file path) |
| `emi_curation/diagnostics.js` (priority 100) | guarded logging; nothing may throw into Forge or EMI |
| `emi_curation/collections.js` (95) | pure `len`/`at` accessors for JS arrays and Java lists; the one copy used by policy, views and hiding |
| `emi_curation/policy.js` (90) | parse and validate the curation JSON. Stack (id, `nbtExceptions` keep, `hideWhenNbtHasKey` hide) and REI display-rule predicates. Pure: no Java, no EMI mutation. |
| `emi_curation/java_interop.js` (85) | class lookup, `isContainerScreen`/`literal` (shared by both buttons), Java reference identity, Java list copy/freeze, `EmiStack` → policy descriptor (NBT walk) |
| `emi_curation/index_view.js` (80) | swap `EmiStackList.filteredStacks` between EMI's list and the CLEAN copy, then refresh search and sidebars. No hide decisions. |
| `emi_curation/recipe_view.js` (70) | JS `EmiRecipeManager` wrapper over the baseline manager, filtering displays |
| `emi_curation/hiding.js` (65) | the single home of hide decisions: `configure({ policy, getMaster })` (called once by `session.js`), then pack policy per stack (cached per registry key) and REI-style display hiding (adds EMI's user-hidden set and the master-index key set, built and cached here) |
| `emi_curation/session.js` (60) | CLEAN/ALL state in `global`, loads the policy and configures `hiding.js`, EMI generation tracking, tick → sync → apply with restore on failure, reload/logout handling, event registration |
| `emi_curation/ui/forge_hooks.js` (58) | `registerOnce(flag, table, hooks)`: add Forge listeners once per launch, dispatching through a reloadable `global.emiCuration[table]` handler table; handler errors are logged, never rethrown. Used by `button.js` and `mods_menu.js`; `session.js` uses `ClientEvents`, not Forge listeners. |
| `emi_curation/ui/placement.js` (55) | shared button placement from EMI's search bounds: pure `chooseRect`, `searchPlaced`, live `layoutContext`/`usableLayout` |
| `emi_curation/ui/button.js` (50) | the CLEAN/ALL button; screen handlers registered through `forge_hooks`. **The Mods menu depends on this button's rect and on load order:** `mods_menu.js` reads `ns.ui.button` to sit beside it, so `button.js` must stay at a higher priority than `mods_menu.js`. |
| `emi_curation/ui/mods_list.js` (47) | pure Mods menu logic, no Java: `parseList`, `visibleEntries`, `nextSearch`, `layoutMenu`, `inside` |
| `emi_curation/ui/mods_text.js` (46) | the text layer: `draw(g, font, text, x, y, color)` via `drawWordWrap` and `width(text)` estimated from font metrics; never `drawString`/`Font.width` (see GOTCHAS) |
| `emi_curation/ui/mods_menu.js` (45) | the Mods dropdown: state, handlers and wiring. Reads `mods.json` (through `mods_list`), places the button beside CLEAN/ALL (`ns.ui.button`, `placement`), draws the rows in `Render.Post`, sets EMI's search text. Registered through `forge_hooks`. |
| `tools/emi_curation/migrate_rei.cjs` | one-shot REI → EMI data migration and its `--check` against the frozen fixture in `tools/emi_curation/fixtures/` |
| `tools/emi_curation/tests/harness.cjs`, `fake_emi.cjs` | Node harness that loads the production scripts (all subfolders) into a `vm` context in KubeJS priority order (plus the shared `fixture()`/`boot()`), and a fake EMI/Java world to drive them |
| `tools/emi_curation/tests/session.test.cjs`, `button.test.cjs`, `mods_menu.test.cjs`, `interop.test.cjs` | session lifecycle and views; button placement and listeners; Mods menu behaviour and pure logic; Java list-copy handling |
| `tools/emi_curation/tests/policy.test.cjs`, `class_filter.test.cjs`, `emi_config.test.cjs`, `migration.test.cjs` | policy rules, class filter, EMI config, migration check |
| `tools/server_smoke/smoke.cjs` | CLI: argument parsing, orchestration (setup, `--drop`, boot, or `--analyze` of a finished run) and printing the verdict |
| `tools/server_smoke/env.cjs` | the machine environment: java, packwiz bootstrap and installer jars, artifacts root, Forge version and URL; each overridable by a `SMOKE_*` env var |
| `tools/server_smoke/setup.cjs`, `procs.cjs` | cached Forge server install, `packwiz-installer -s server` install, `dropMods`; hidden child processes (`start`, `run`) and tree kill |
| `tools/server_smoke/boot.cjs` | boot supervisor: spawn hidden, tee the console, wait for `Done (` or a crash report, send `stop`, kill the tree on timeout |
| `tools/server_smoke/verdict.cjs` | pure PASS/FAIL decision and crash-report parsing (mod name and failure message) |
| `tools/server_smoke/log_report.cjs`, `known_noise.json` | pure log grouping: errors and exceptions by signature, known boot noise vs new; the `DONE_RE` regex |
| `tools/emi_coverage/scan_jars.cjs`, `zip_reader.cjs` | read-only scan of mod jars for viewer plugin coverage; `zip_reader` is its dependency-free jar reader |

`docs/emi.md` is the architecture doc for the EMI subsystem (there is no separate `ARCHITECTURE.md`).

KubeJS loads client scripts in descending `// priority:` order. Each script adds one
namespace to `global.emiCuration`. Only `session.js` (through `ClientEvents`), `ui/button.js` and `ui/mods_menu.js` (through `ui/forge_hooks.js`) register event
handlers.

## Dependencies

- The curation scripts depend on **EMI internals** (`EmiStackList`, `EmiRecipes.manager`, `EmiSearch`, `EmiScreenManager`, `EmiReloadManager`, `EmiHidden`). Those are confined to `index_view.js`, `recipe_view.js`, `hiding.js` (`EmiHidden`), `session.js` (`EmiReloadManager`), `ui/placement.js` (`EmiScreenManager`) and `ui/mods_menu.js` (the search widget). EMI is pinned to 1.1.24+1.20.1+forge, so re-verify these before changing its version.
- JEI must stay installed: EMI's JEMI bridge only loads JEI plugins when JEI is present.
- Tooling needs Node 22 and git (`rehash.cjs` lists files with `git ls-files`). There is no packwiz CLI, Python or build step.
- The installer is `packwiz-installer-bootstrap.jar` in `C:/Users/dirty/MultiMC/packwiz/`, outside the repo. See `docs/development.md`.

## Structural debt

Baseline review 2026-10-12. Remaining debt is filed in Docket (`docs/items/`, `dk list`):

- Recipe-wrapper lifecycle still lives in `session.js`; it belongs with `recipe_view` (dk-b787a93f).
- `interop.filterToList` is missing; list filtering is repeated in the views (dk-b9ec6a98).
- Classification is cached in more than one place; one cache is wanted (dk-8a0232a6).
- `migrate_rei.cjs` is one-shot tooling: retire or split it (dk-eaeaf6eb).
- Repeated table reads need a `readTable` helper (dk-0eb48f8f).
- `tools/emi_curation/fixtures/` holds a single file: flatten it (dk-232fd37d).
- The EMI views rely on public-but-internal EMI fields. A custom mod would avoid that but would need building and hosting. Rejected for now; see `docs/DECISIONS.md`.

Last full review: 2026-10-12
