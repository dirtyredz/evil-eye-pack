# Structure

A packwiz modpack (Minecraft 1.20.1, Forge 47.4.10). The repository holds packwiz
metadata, configs and client scripts that packwiz installs into an instance. It also holds
unshipped tooling and docs, which `.packwizignore` keeps out of the index.

## Layout

- `pack.toml` — pack definition; its `[index]` hash is sha256 of `index.toml`
- `index.toml` — every installed file with its sha256 (rebuild with `tools/packwiz/rehash.cjs`)
- `mods/` — packwiz metafiles (`*.pw.toml`), one per mod jar (CurseForge, Modrinth, or a direct URL such as the owner's GitHub-released Dank Recipe Transfer)
- `shaderpacks/` — shaderpack metafiles and saved shader options
- `resourcepacks/` — resource pack metafiles (`*.pw.toml`) installed into the instance
- `config/` — mod configs installed as plain files
- `config/defaultoptions/keybindings.txt` — Default Options default keymap (new instances only; see GOTCHAS)
- `config/emi-curation/` — EMI curation data: `rules.json`, four explicit item lists, `decor.json` (the DECOR toggle's rules), `mods.json` (Mods menu overrides: rename, hide, pin); the owner's `decor-local.json` is created in game and never shipped
- `defaultconfigs/` — Forge default (per-world) configs
- `kubejs/client_scripts/emi_curation/` — client scripts for the curated EMI views (diagnostics, collections, policy, interop, views, hiding, session)
- `kubejs/client_scripts/emi_curation/decor/` — the DECOR rules: pure policy, the local marks (`decor_local.js`) and the Java tag adapter
- `kubejs/client_scripts/emi_curation/ui/` — the CLEAN/ALL button, the DECOR button, the mark-as-decor key handler, the Mods menu and what they share (placement, Forge listener registration). KubeJS loads subfolders and sorts the whole pack by priority, so folders do not change load order.
- `kubejs/startup_scripts/` — `emi_curation_keys.js` registers the "EMI Curation" key mapping (startup-only in Forge); `kubejs/assets/emi_curation/lang/` names it
- `kubejs/server_scripts/dedup.js`, `kubejs/config/dedup*.json` ? permanent duplicate recipe/tag policy; no stack conversion. Generated recipe/loot overrides live under `kubejs/data/<owning-mod>/`, permanent EMI removals under `kubejs/assets/emi/index/stacks/`. Survivor choices: `docs/ato-retirement.md`.
- `tools/dedup/` ? pinned cached-jar scanner, data override generator, duplicate-material guard and tests; `allowed_groups.json` records narrow exceptions.
- `tools/emi_curation/` — unshipped: Node tests for the curation scripts (`tests/`)
- `tools/packwiz/tests/`, `tools/server_smoke/tests/`, `tools/pack_test/tests/` — Node test suites, run together with the `tools/emi_curation/tests/` ones (`node --test tools/dedup/tests/*.cjs tools/packwiz/tests/*.cjs tools/emi_curation/tests/*.cjs tools/server_smoke/tests/*.cjs tools/pack_test/tests/*.cjs`)
- `tools/emi_coverage/` — unshipped: read-only jar scanner for viewer plugin coverage
- `tools/server_smoke/` — unshipped: headless Forge server compatibility smoke (`smoke.cjs`), its environment, setup, boot, process, watchdog, verdict and log-analysis modules, and known boot noise
- `tools/pack_test/` — unshipped: one-boot automated pack test (`run.cjs`): runner, report, baseline and protocol modules; `checks/` (pure Node checks over the probe's evidence), `probe/` (KubeJS server scripts injected into the throwaway server only, never shipped), `remote/` (ANU target: sync, launch, collect), `data/` (policy, fixtures, baseline), `tests/`
- `tools/packwiz/` — unshipped: hash-chain verifier, index rebuild, localhost pack server, tests
- `docs/` — unshipped living docs (development workflow, decisions, gotchas, EMI guide and integration coverage)
- `docs/items/`, `docket.json` — Docket work-item store (use `dk`); `AGENTS.md` — agent instructions. All unshipped.

## Components

| Component | Responsibility |
|---|---|
| `tools/packwiz/pack_index.cjs` | index/pack TOML parse and format (`readTable` is the one `key = "value"` table reader), `isMetafile`, `.packwizignore`, byte hashing, `publishableFiles()` (the one publishable-file set used by rehash and verify) |
| `tools/packwiz/rehash.cjs` | rebuild `index.toml` membership and hashes, then `pack.toml`'s index hash |
| `tools/packwiz/verify_hashes.cjs` | check the hash chain, index membership and optionally jar hashes |
| `tools/packwiz/serve.cjs` | serve the containing checkout on `127.0.0.1` over HTTP (not used by MultiMC: local instances install from the file path) |
| `emi_curation/diagnostics.js` (priority 100) | guarded logging; nothing may throw into Forge or EMI |
| `emi_curation/collections.js` (95) | pure `len`/`at` accessors for JS arrays and Java lists; the one copy used by policy, views and hiding |
| `emi_curation/policy.js` (90) | parse and validate the curation JSON. Stack (id, `nbtExceptions` keep, `hideWhenNbtHasKey` hide) and REI display-rule predicates. Pure: no Java, no EMI mutation. |
| `emi_curation/java_interop.js` (85) | class lookup, `isContainerScreen`/`literal` (shared by both buttons), Java reference identity, Java list copy/freeze, list filtering (`filterToList`), item-key test (`isItemKey`), `EmiStack` → policy descriptor (NBT walk) |
| `emi_curation/index_view.js` (80) | swap `EmiStackList.filteredStacks` between EMI's list and the CLEAN copy, then refresh search and sidebars. No hide decisions. |
| `emi_curation/recipe_view.js` (70) | JS `EmiRecipeManager` wrapper over the baseline manager, filtering displays |
| `emi_curation/hiding.js` (65) | the single home of hide decisions: `configure({ policy, getMaster })` (called once by `session.js`), then pack policy per stack (cached per registry key; DECOR is decided in `decor_state.js`, never here) and REI-style display hiding (adds EMI's user-hidden set and the master-index key set, built and cached here) |
| `emi_curation/decor/decor_state.js` (62) | the single home of DECOR state: loads `decor.json` and `decor-local.json`, holds the local-marks holder, the per-key classification cache and tag-set reset behind one `invalidate()`, `isHidden(stack)`, the SHOWN/HIDDEN mode override (`flip`/`setOverride`/`resetMode`, in `global.emiCuration.decorMode`), `label()` and `mark(id, wholeMod)`. Never feeds recipe displays. |
| `emi_curation/session.js` (60) | CLEAN/ALL state in `global`, loads the policy (and calls `decorState.load`), configures `hiding.js`, combines CLEAN/ALL x DECOR into the index view key, EMI generation tracking, tick → sync → apply with restore on failure, reload/logout handling, event registration |
| `emi_curation/ui/forge_hooks.js` (58) | `registerOnce(flag, table, hooks)`: add Forge listeners once per launch, dispatching through a reloadable `global.emiCuration[table]` handler table; handler errors are logged, never rethrown. Used by `button.js`, `mods_menu.js`, `decor_button.js` and `decor_mark.js`; `session.js` uses `ClientEvents`, not Forge listeners. |
| `emi_curation/ui/emi_screen.js` (57) | the one adapter over `EmiScreenManager`'s screen state: `searchWidget`, `searchFocused`, `hoveredEmiStack(x, y)`, `panelAt(x, y)`. Used by `placement.js`, `mods_menu.js` and `decor_mark.js`. |
| `emi_curation/ui/placement.js` (55) | shared button placement from EMI's search bounds: pure `chooseRect`, `searchPlaced`, live `layoutContext`/`usableLayout` |
| `emi_curation/ui/button.js` (50) | the CLEAN/ALL button; screen handlers registered through `forge_hooks`. **The Mods menu depends on this button's rect and on load order:** `mods_menu.js` reads `ns.ui.button` to sit beside it, so `button.js` must stay at a higher priority than `mods_menu.js`. |
| `emi_curation/decor/decor_policy.js` (89) | pure DECOR rules: parse/validate `decor.json`, `classify(policy, id, inTags)` over the manual-exception, whole-mod and tag layers. No Java. |
| `emi_curation/decor/decor_tags.js` (84) | Java side of the tag layer: item and block tags from the live registries into one cached `HashSet` of Items; `reset()` per EMI generation |
| `emi_curation/ui/mods_layout.js` (48) | pure dropdown geometry, no Java: `layoutMenu`, `paginate`/`layoutPaged` (pages plus the Prev/Next strip), `shiftClear`, `inside` |
| `emi_curation/ui/mods_source.js` (49) | the Mods menu's entries: namespaces owning a stack of the current index, `Platform` names, overrides from `mods.json`; cached per index list |
| `emi_curation/ui/mods_list.js` (47) | pure Mods menu data logic, no Java: `parseOverrides`, `buildEntries` (A-Z, rename, hide, pin), `nextSearch` |
| `emi_curation/decor/decor_local.js` (88) | pure local DECOR marks: parse/serialize `decor-local.json`, `lookup` (item mark, then mod mark, else null), the automatic/decor/not-decor `cycle*`, `load`/`mark` over an injected IO, and `kubeIo()` (KubeJS `JsonIO`) |
| `emi_curation/ui/decor_mark.js` (43) | the mark-as-decor key: Forge `KeyPressed.Pre` listener, hovered item from EMI (`emiScreen.hoveredEmiStack`) or the vanilla slot, toast, then `decorState.mark` and `session.refreshDecor()`. The key mapping comes from `kubejs/startup_scripts/emi_curation_keys.js` as `global.emiCurationDecorKey` (Forge accepts key mappings only at startup; without it this script logs once and does nothing). |
| `emi_curation/ui/decor_button.js` (44) | the DECOR: SHOWN/HIDDEN button (label from `decorState`; pressability and the toggle through `session.canPressDecor`/`toggleDecor`, which re-apply the index); loads after `button.js` and `mods_menu.js` so it settles beside them in one pass (Forge calls listeners in registration order) |
| `emi_curation/ui/mods_text.js` (46) | the text layer: `draw(g, font, text, x, y, color)` via `drawWordWrap` and `width(text)` estimated from font metrics; never `drawString`/`Font.width` (see GOTCHAS) |
| `emi_curation/ui/mods_menu.js` (45) | the Mods dropdown: state, handlers and wiring. Builds its rows from `mods_source`, pages them with `mods_layout`, places the button beside CLEAN/ALL (`ns.ui.button`, `placement`), draws the rows in `Render.Post`, sets EMI's search text. Registered through `forge_hooks`. |
| `tools/emi_curation/tests/harness.cjs`, `fake_emi.cjs`, `fixture.cjs` | Node harness that loads the production scripts (all subfolders) into a `vm` context in KubeJS priority order (plus `boot()`), a fake EMI/Java world to drive them, and the shared test world data (`fixture()`: named stacks and recipes) |
| `tools/emi_curation/tests/session.test.cjs`, `button.test.cjs`, `mods_menu.test.cjs`, `decor.test.cjs`, `decor_local.test.cjs` (shared world: `decor_world.cjs`), `interop.test.cjs` | session lifecycle and views; button placement and listeners; Mods menu behaviour, auto list, paging and pure logic; DECOR rules, toggle, persistence and button; Java list-copy handling |
| `tools/emi_curation/tests/policy.test.cjs`, `class_filter.test.cjs`, `emi_config.test.cjs` | policy rules (including the real curation lists), class filter, EMI config |
| `tools/server_smoke/smoke.cjs` | CLI: argument parsing, orchestration (setup, `--drop`, boot, or `--analyze` of a finished run) and printing the verdict |
| `tools/server_smoke/env.cjs` | the machine environment: java, packwiz bootstrap and installer jars, artifacts root, Forge version and URL; each overridable by a `SMOKE_*` env var |
| `tools/server_smoke/setup.cjs`, `procs.cjs` | cached Forge server install, `packwiz-installer -s server` install, `level-seed` (`--seed`, `readRunSeed`), `dropMods` (each install takes an optional process scope); hidden child processes: `procs.scope()` owns what it starts (`start`, bounded `run`, `killAll`), plus tree kill, JVM priority and CPU time (`setPriority`, `cpuSeconds`) |
| `tools/server_smoke/boot.cjs` | boot supervisor: spawn hidden, tee the console, raise JVM priority, wait for `Done (` (line-buffered) or a crash report under the progress watchdog; with `complete()`, keep waiting after Done for the caller's own completion (bounded by `completeTimeout`); `finally` stop and cleanup |
| `tools/server_smoke/cpu_sampler.cjs`, `shutdown.cjs` | one-in-flight CPU sampling with last-growth time; ending a boot: `stop` with grace, bounded jcmd thread dump, tree kill, scope cleanup, bounded log close |
| `tools/server_smoke/watchdog.cjs` | pure watchdog decision (log silent AND CPU flat, hard cap) and CPU-per-wall starvation test |
| `tools/server_smoke/verdict.cjs` | pure PASS/STALL/HOST STARVED/FAIL decision (worldgen-stall classification) and crash-report parsing (mod name and failure message) |
| `tools/server_smoke/log_report.cjs`, `known_noise.json` | pure log grouping: errors and exceptions by signature, known boot noise vs new; the `DONE_RE` and `SPAWN_RE` regexes |
| `tools/dedup/guard.cjs` | duplicate-group allowance comparison (unexplained, changed, stale) shared by the cached-jar test and the pack test's live check |
| `tools/pack_test/run.cjs`, `analyze.cjs` | CLI and orchestration (verify, stage, scan, boot locally or on ANU, analyse); offline analysis of a run folder: load evidence, run every check, write report/summary/candidate baseline |
| `tools/pack_test/session/` | before and during the boot: `prepare` (artifact-root guard, run metadata, staged server, per-run copy with hard-linked jars, world cache, probe injection, shipped-config scan), `execute` (one boot until the probe manifest, evidence collection), `resources` (raw data scan of the installed jars and KubeJS data), `lock` (local file lock, ANU heartbeat dir lock) |
| `tools/pack_test/probe/` | KubeJS server scripts injected into the test server only: `registries` (registries, final tags, mods, loot tables), `recipes` (every live recipe normalized), `crafting` (FakePlayer crafts in a real crafting menu), `bootstrap` (sections, payloads, manifest last) |
| `tools/pack_test/checks/` | pure checks over the evidence: `recipes` (+ `conditions` evaluator), `references`, `acquisition`, `machines`, `crafting`, `dedup`, `logs` |
| `tools/pack_test/verdict/` | `protocol` (probe contract and validation), `baseline` (finding identity, new/known/resolved), `report` (report.json, summary.txt, exit code), `policy` (tool data and the acquisition exclusion policy) |
| `tools/pack_test/remote/` | ANU target: `config`, `ssh` (encoded PowerShell over SSH, scp), `sync` (manifest-diff tar sync), `provision` (portable Node/JDK, README), `anu` (lock, sync, detached launch, poll, pull), `agent` (runs on ANU) |
| `tools/emi_coverage/scan_jars.cjs`, `zip_reader.cjs` | read-only scan of mod jars for viewer plugin coverage; `zip_reader` is its dependency-free jar reader |

`docs/emi.md` is the architecture doc for the EMI subsystem (there is no separate `ARCHITECTURE.md`).

KubeJS loads client scripts in descending `// priority:` order. Each script adds one
namespace to `global.emiCuration`. Only `session.js` (through `ClientEvents`), `ui/button.js`, `ui/mods_menu.js`, `ui/decor_button.js` and `ui/decor_mark.js` (through `ui/forge_hooks.js`) register event
handlers.

## Dependencies

- The curation scripts depend on **EMI internals** (`EmiStackList`, `EmiRecipes.manager`, `EmiSearch`, `EmiScreenManager`, `EmiReloadManager`, `EmiHidden`). Those are confined to `index_view.js` (also its `EmiScreenManager` refresh), `recipe_view.js`, `hiding.js` (`EmiHidden`), `session.js` (`EmiReloadManager`) and `ui/emi_screen.js` (the `EmiScreenManager` search widget and hover lookups; `placement.js`, `mods_menu.js` and `decor_mark.js` go through it). EMI is pinned to 1.1.24+1.20.1+forge, so re-verify these before changing its version.
- JEI must stay installed: EMI's JEMI bridge only loads JEI plugins when JEI is present.
- Tooling needs Node 22 and git (`rehash.cjs` lists files with `git ls-files`). There is no packwiz CLI, Python or build step.
- The installer is `packwiz-installer-bootstrap.jar` in `C:/Users/dirty/MultiMC/packwiz/`, outside the repo. See `docs/development.md`.
- The pack test needs `ssh`/`scp`/`tar` on Valhalla for its ANU target, and on ANU only what `remote/provision.cjs` installs under `C:Toolsevil-eye-pack`.

## Structural debt

Baseline review 2026-10-12. Remaining debt is filed in Docket (`docs/items/`, `dk list`):

- Recipe-wrapper lifecycle still lives in `session.js`; it belongs with `recipe_view` (dk-b787a93f).
- Classification is cached in more than one place; one cache is wanted (dk-8a0232a6).
- The EMI views rely on public-but-internal EMI fields. A custom mod would avoid that but would need building and hosting. Rejected for now; see `docs/DECISIONS.md`.

Last full review: 2026-10-12
