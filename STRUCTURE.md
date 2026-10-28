# Structure

A packwiz modpack (Minecraft 1.20.1, Forge 47.4.10). The repository holds packwiz
metadata, configs and client scripts that packwiz installs into an instance. It also holds
unshipped tooling and docs, which `.packwizignore` keeps out of the index.

## Layout

Folder map derived from `git ls-files`; expanded at the busy subtrees below.

```text
|-- config/
|   |-- defaultoptions/
|   `-- emi-curation/
|-- defaultconfigs/
|-- docs/
|   `-- items/
|-- kubejs/
|   |-- assets/
|   |-- client_scripts/
|   |   `-- emi_curation/
|   |       |-- decor/
|   |       `-- ui/
|   |           `-- mods/
|   |-- config/
|   |-- data/
|   |-- server_scripts/
|   |   `-- showcase/
|   |       |-- rigs/
|   |       `-- sections/
|   `-- startup_scripts/
|-- mods/
|-- resourcepacks/
|-- shaderpacks/
|-- scripts/
|   |-- mod-map/
|   `-- owner/
`-- tools/
    |-- data_io/
    |-- dedup/
    |   `-- tests/
    |-- emi_coverage/
    |-- emi_curation/
    |   `-- tests/
    |       `-- support/
    |-- malware_guard/
    |   |-- data/
    |   |-- scanning/
    |   `-- tests/
    |-- mod_map/
    |   |-- capture/
    |   |-- inventory/
    |   |-- model/
    |   |-- page/
    |   `-- tests/
    |       |-- capture/
    |       |-- inventory/
    |       |-- model/
    |       `-- page/
    |-- pack_test/
    |   |-- checks/
    |   |   `-- security/
    |   |-- data/
    |   |-- probe/
    |   |-- remote/
    |   |   `-- lease/
    |   |-- session/
    |   |-- tests/
    |   |   |-- checks/
    |   |   |-- remote/
    |   |   |-- session/
    |   |   `-- verdict/
    |   `-- verdict/
    |-- packwiz/
    |   `-- tests/
    |-- server_smoke/
    |   `-- tests/
    |-- script-run/
    `-- showcase/
        |-- checks/
        `-- tests/
```

- `pack.toml` — pack definition; its `[index]` hash is sha256 of `index.toml`
- `index.toml` — every installed file with its sha256 (rebuild with `tools/packwiz/rehash.cjs`)
- `mods/` — packwiz metafiles (`*.pw.toml`), one per mod jar (CurseForge, Modrinth, or a direct URL such as the owner's GitHub-released Dank Recipe Transfer)
- `shaderpacks/` — shaderpack metafiles and saved shader options
- `resourcepacks/` — resource pack metafiles (`*.pw.toml`) installed into the instance
- `config/` — mod configs installed as plain files
- `config/defaultoptions/keybindings.txt` — Default Options default keymap (new instances only; see GOTCHAS)
- `config/emi-curation/` — EMI curation data: `rules.json`, four explicit item lists, `decor.json` (the DECOR toggle's rules), `mods.json` (Mods menu overrides: rename, hide, pin); the owner's `decor-local.json` is created in game and never shipped
- `defaultconfigs/` — Forge default (per-world) configs; Hourglass replaces the removed Enhanced Celestials/Corgi stack and sets half-speed day, vanilla-speed night and vanilla sleeping for new worlds
- `kubejs/client_scripts/emi_curation/` — client scripts for the curated EMI views (diagnostics, collections, policy, interop, views, hiding, session)
- `kubejs/client_scripts/emi_curation/decor/` — the DECOR rules: pure policy, the local marks (`decor_local.js`) and the Java tag adapter
- `kubejs/client_scripts/emi_curation/ui/` — the CLEAN/ALL button, the DECOR button, the mark-as-decor key handler and shared UI infrastructure (placement, Forge listener registration). KubeJS loads subfolders and sorts the whole pack by priority, so folders do not change load order.
- `kubejs/client_scripts/emi_curation/ui/mods/` — Mods dropdown, source entries, layout, list policy and text drawing.
- `kubejs/startup_scripts/` — `emi_curation_keys.js` registers the "EMI Curation" key mapping (startup-only in Forge); `kubejs/assets/emi_curation/lang/` names it
- `kubejs/server_scripts/showcase/` — bounded plans, multi-section layout, plot records, staged construction, entity policy, control dispatch and commands; `sections/` holds pure content factories, and `rigs/` owns section-specific validation and world mechanics.
- `kubejs/server_scripts/dedup.js` — permanent duplicate recipe/tag cleanup; no stack conversion. Survivor choices: `docs/duplicate-cleanup.md`.
- `kubejs/config/dedup.json` — authored duplicate policy; the generator never writes this input.
- `kubejs/config/dedup_sources.json` — generated recipe removals, survivor tags and block-tag removals derived from pinned jar block loot tables.
- `kubejs/data/*/recipes/`, `kubejs/data/*/loot_tables/` — generated dedup overrides alongside hand-written data recipes.
- `kubejs/assets/emi/index/stacks/dedup.json` — generated permanent EMI removals.
- `kubejs/data/` — hand-written and generated data overrides (recipes, loot tables, tags), one folder per owning mod (`kubejs/data/<mod>/...`); flat by design, one folder per mod that has an override
- `kubejs/assets/emi/` — EMI resource overrides; today only `index/stacks/` (permanent EMI removals written by the dedup generator)
- `tools/data_io/` — shared Node data I/O: ZIP reading, ordered jar traversal, strict JSON file reading and byte hashing (`hashBytes`, `sha256`).
- `tools/mod_map/` — offline mod map. `build.mjs` (entry) and `run.cjs` (orchestration, artifact guards, saved-evidence replay) at the top; `inventory/` pinned-jar inventory and the `mods.toml`-only reader; `model/` dependency graph, classification, cost, families, categories and their checked-in data (`overrides.json` reasoned kind/family corrections, undeclared dependencies and pack-wide fixes; `categories.json` family/standalone ID → category); `capture/` the one-boot instrumented capture and TRACE timing; `page/` the pure view, HTML builders, document shell, CSS and browser controls. `tests/` mirrors those folders; `tests/fixtures.cjs` is a shared helper outside the `*/*.test.cjs` glob.
- `scripts/` — owner-run PowerShell entry points, one `scripts/<area>/<verb>.ps1` per owner command; Node tooling sits underneath in `tools/`. Scripts and their logs (ignored `.tmp/`) are packwiz-excluded.
- `scripts/mod-map/` — `build.ps1`, the mod map owner entry point (wraps `tools/mod_map/build.mjs`).
- `scripts/owner/` — `owner-run.ps1`, the verbatim owner-run 1.0.0 template every owner script dot-sources (logging, OK/FAILED line).
- `tools/script-run/` — the verbatim Node script-run 1.1.0 template (`script-run.mjs`) and its test from `~/.claude/templates/scripts/`; Node entry points such as `tools/mod_map/build.mjs` run through it.
- `tools/malware_guard/` — offline content scanner, instance drift and metadata source/known-bad gate; opt-in cached Modrinth status, approval CLI, `data/` policies and synthetic `tests/`. Local reports/cache are ignored under `.local/`.
- `tools/dedup/` — pinned cached-jar scanner, data override generator, duplicate-material guard and tests; `allowed_groups.json` records narrow exceptions; `hidden_reasons.json` holds the reason for every `hiddenOnly` id (see docs/development.md "Known exceptions registry").
- `tools/emi_curation/` — unshipped: Node tests for the curation scripts (`tests/`)
- `tools/malware_guard/tests/`, `tools/packwiz/tests/`, `tools/server_smoke/tests/`, `tools/pack_test/tests/`, `tools/showcase/tests/`, `tools/mod_map/tests/`, `tools/script-run/` — Node test suites, run together with the `tools/emi_curation/tests/` ones (`node --test tools/malware_guard/tests/*.test.cjs tools/dedup/tests/*.cjs tools/packwiz/tests/*.cjs tools/emi_curation/tests/*.cjs tools/server_smoke/tests/*.cjs tools/pack_test/tests/*/*.cjs tools/showcase/tests/*.cjs tools/mod_map/tests/*/*.test.cjs tools/script-run/*.test.mjs`)
- `tools/emi_coverage/` — unshipped: read-only jar scanner for viewer plugin coverage
- `tools/showcase/` — offline headless runner, probe lifecycle, assertion helpers, shared terrain and registry-wide command checks; `checks/` holds section behaviour checks and `tests/` the focused Node VM/runner tests.
- `tools/server_smoke/` — unshipped: headless Forge server compatibility smoke (`smoke.cjs`), its environment, setup, boot, process, watchdog, verdict and log-analysis modules, and known boot noise
- `tools/pack_test/` — unshipped: one-boot automated pack test (`run.cjs` and `analyze.cjs`); `recipe_json.cjs`, `stage_runtime.cjs`, `session/`, `checks/` (including security checks in `checks/security/`), `verdict/`, `probe/`, `remote/` (with the `lease/` cluster), `data/`, `tests/`. See the Components table below for module responsibilities; `data/` holds baseline, crafts, machines and policy JSON (`policy.json` carries `removedMods` and `requiredMods`); `tests/` mirrors the source with `checks/`, `data/`, `remote/`, `verdict/` and `session/`.
- `tools/packwiz/` — unshipped: hash-chain verifier, index rebuild, localhost pack server, tests
- `docs/` — unshipped living docs (development workflow, decisions, gotchas, EMI guide and integration coverage)
- `docs/items/`, `docket.json` — Docket work-item store (use `dk`); `AGENTS.md` — agent instructions. All unshipped.

## Components

Showcase layout and extension guide: [docs/showcases.md](docs/showcases.md).

| Component | Responsibility |
|---|---|
| `kubejs/server_scripts/showcase/plan.js` | pure plan bounds, shared floor, placement/sign helpers, registry, rig dispatch and multi-section layout/source-to-origin math |
| `kubejs/server_scripts/showcase/sections/*.js` | one self-registering content plan per section; no world access |
| `kubejs/server_scripts/showcase/plots.js` | persistent records, plot keys, overlap replacement and serialized rig ownership |
| `kubejs/server_scripts/showcase/construction.js` | read-only preflight, then teardown/reserve/place/finish stages; generic world writes and rig hooks |
| `kubejs/server_scripts/showcase/rigs/create_contraption.js` | Create descriptor validation, glue boundary/entity policy, motor zeroing, bearing teardown, collision preparation and lever control; legacy record compatibility |
| `kubejs/server_scripts/showcase/entities.js` | entity policy for clearing: discard ordinary, block on player/tamed/named |
| `kubejs/server_scripts/showcase/controls.js`, `command.js` | record-only rig tick dispatch and op-only command tree |
| `tools/showcase/check.cjs`, `offline.cjs` | one-boot CLI, reports/log comparison; pinned offline server preparation (pins through `packwiz/pinned_jar.cjs`) with a `showcase` (flat, no spawns) or `ordinary` world profile, using existing pack-test/server-smoke modules |
| `tools/mod_map/run.cjs`, `build.mjs` | mod map orchestration: options, artifact and read-only-input guards, saved-evidence identity checks, inventory → model → capture/timing → page; `build.mjs` runs it through script-run |
| `tools/mod_map/inventory/` (`inventory.cjs`, `mods_toml.cjs`) | pinned jars → nodes with declared jar-in-jar traversal and bundle reconciliation; the Forge `mods.toml`-only scalar reader (metafiles use `pack_index` `readTable`) |
| `tools/mod_map/model/` (`graph.cjs`, `classify.cjs`, `cost.cjs`, `families.cjs`, `categories.cjs`) | mandatory edges to physical jars; per-mod kind with evidence and the one `isLibrary(classifications, node)`; measured cost per unique mod ID; families by root selection, content membership and library ownership; purpose categories from `categories.json` |
| `tools/mod_map/capture/` (`capture.cjs`, `timing.cjs`) | one local offline boot with a narrow FML TRACE log4j config and a registry snapshot; pairing TRACE intervals before `DONE_RE` |
| `tools/mod_map/page/` (`view.cjs`, `html.cjs`, `document.cjs`, `page.css`, `page.js`) | pure view derivation (ranking, trees, cards) over finished data; escaped HTML fragments; the self-contained document shell; styles and browser-only controls |
| `tools/showcase/harness.js`, `helpers.js` | probe sequencing/lifecycle/completion; `makeHelpers` supplies fixture access and plan/volume assertions |
| `tools/showcase/command_forms.js`, `terrain.js`, `checks/*.js`, `tests/*.cjs` | one registry-wide command check per boot; shared hostile terrain checks; section-specific behaviour checks and focused Node tests |
| `tools/malware_guard/cli.cjs` | `scan`, `drift`, `gate`, explicit online `status` and hash-based `approve`; applies approvals once to raw reports before JSON output and exits 0/1/2 |
| `tools/malware_guard/scanning/` (`scan.cjs`, `signatures.cjs`) | bounded recursive archive/folder scan using shared byte jar traversal; entry hashes, class signatures and tunable loader co-occurrence heuristics |
| `tools/malware_guard/metadata.cjs` | packwiz installed-path inventory and expected pinned hashes |
| `tools/malware_guard/tests/*.test.cjs` | synthetic scanning, signature validation, approval identity, metadata/drift and injected status tests; `fixtures.cjs` is a helper excluded by the test glob |
| `tools/malware_guard/drift.cjs`, `gate.cjs` | instance drift over the inventory expected map; source/hash validation, URL identities and known-bad matching |
| `tools/malware_guard/policy.cjs`, `status.cjs`, `data/` | finding and owner approval kinds with shared keys and report application; separate injected HTTP/cache client; allowlist, owner-added hashes, known-bad projects, validated signature patterns and heuristic limits |
| `tools/pack_test/session/security.cjs` | collect raw reports with explicit scan/gate/drift kinds before boot; write malware.json without policy |
| `tools/pack_test/checks/security/malware.cjs` | read raw or legacy evidence and apply current approvals once into the offline malware section |
| `kubejs/server_scripts/dedup.js` | applies authored dedup policy and generated recipe/tag cleanup; hand-written server recipes go in a script named for the concern, not dedup.js |
| `kubejs/server_scripts/uranium.js` | hand-written Alex's Caves / Create crushed-uranium → yellorium smelting and blasting recipes |
| `tools/packwiz/pack_index.cjs` | index/pack TOML parse and format (`readTable` reads string tables and numeric CurseForge IDs; metafile name/download/side readers share the model), `isMetafile`, `.packwizignore`, `publishableFiles()` (the one publishable-file set used by rehash and verify) |
| `tools/packwiz/pinned_jar.cjs` | `resolvePinnedJar(metafileText, dirs)`: the one pinned-jar lookup (safe filename, ordered folders, hash-verified bytes, fail closed, never downloads); used by showcase preparation and the mod map |
| `tools/packwiz/rehash.cjs` | rebuild `index.toml` membership and hashes, then `pack.toml`'s index hash |
| `tools/packwiz/verify_hashes.cjs` | check the hash chain, index membership and optionally jar hashes |
| `tools/packwiz/serve.cjs` | serve the containing checkout on `127.0.0.1` over HTTP (not used by MultiMC: local instances install from the file path) |
| `emi_curation/diagnostics.js` (priority 100) | guarded logging; nothing may throw into Forge or EMI |
| `emi_curation/collections.js` (95) | pure `len`/`at` accessors for JS arrays and Java lists, plus `ns.ids.split`/`namespaceOf` for resource ids; shared by policy, views, hiding, DECOR and Mods |
| `emi_curation/policy.js` (90) | parse and validate the curation JSON into one `nbtRules` map. Stack (id, `nbtExceptions` keep, `hideWhenNbtHasKey` hide) and REI display-rule predicates. Pure: no Java, no EMI mutation or classification cache; `classifyId` returns a verdict consumed by `verdictHidden`. |
| `emi_curation/java_interop.js` (85) | class lookup, `isContainerScreen`/`literal` (shared by both buttons), Java reference identity, Java list copy/freeze, list filtering (`filterToList`), item-key test (`isItemKey`), `EmiStack` → policy descriptor (NBT walk) |
| `emi_curation/index_view.js` (80) | swap `EmiStackList.filteredStacks` between EMI's list and the CLEAN copy, then refresh search and sidebars. No hide decisions. |
| `emi_curation/recipe_view.js` (70) | JS `EmiRecipeManager` wrapper and its lifecycle: persistent `recipeState`, `viewFor`/`unwrap`, generation sync, reload token, Java proxy cache, apply/restore/release/reset; filters displays |
| `emi_curation/hiding.js` (65) | the single home of hide decisions: `configure({ policy, getMaster })` (called once by `session.js`), then pack policy per stack (the single classification cache holds verdicts per registry key; DECOR is decided in `decor_state.js`, never here) and REI-style display hiding (adds EMI's user-hidden set and the master-index key set, built and cached here) |
| `emi_curation/decor/decor_state.js` (62) | the single home of DECOR state: loads `decor.json` and `decor-local.json`, holds the local-marks holder, the per-key classification cache and tag-set reset behind one `invalidate()`, `isHidden(stack)`, the SHOWN/HIDDEN mode override (`flip`/`setOverride`/`resetMode`, in `global.emiCuration.decorMode`), `label()` and `mark(id, wholeMod)`. Never feeds recipe displays. |
| `emi_curation/session.js` (60) | CLEAN/ALL state in `global`, loads the policy (and calls `decorState.load`), configures `hiding.js`, combines CLEAN/ALL x DECOR into the index view key, EMI generation tracking, tick → sync → apply with restore on failure, reload/logout handling, event registration |
| `emi_curation/ui/forge_hooks.js` (58) | `registerOnce(flag, table, hooks)`: add Forge listeners once per launch, dispatching through a reloadable `global.emiCuration[table]` handler table; handler errors are logged, never rethrown. Used by `button.js`, `mods_menu.js`, `decor_button.js` and `decor_mark.js`; `session.js` uses `ClientEvents`, not Forge listeners. |
| `emi_curation/ui/emi_screen.js` (57) | the one adapter over `EmiScreenManager`'s screen state: `searchWidget`, `searchFocused`, `hoveredEmiStack(x, y)`, `panelAt(x, y)`. Used by `placement.js`, `mods_menu.js` and `decor_mark.js`. |
| `emi_curation/ui/placement.js` (55) | shared button placement from EMI's search bounds: pure `chooseRect`, `searchPlaced`, live `layoutContext`/`usableLayout`; toolbar rect registry (`register`, `rect`, `rects`), with live visible rects published by each widget |
| `emi_curation/ui/screen_button.js` (54) | `makeScreenButton`: shared CLEAN/DECOR widget holder, placement, label, guarded press/refresh and reloadable Forge handler registration; called by the button configs at their original priorities |
| `emi_curation/ui/button.js` (50) | the CLEAN/ALL button config for `makeScreenButton`. Publishes the CLEAN rect to `placement`; priorities preserve CLEAN → Mods → DECOR placement in one frame. |
| `emi_curation/decor/decor_policy.js` (89) | pure DECOR rules: parse/validate `decor.json`, `classify(policy, id, inTags)` over the manual-exception, whole-mod and tag layers. No Java. |
| `emi_curation/decor/decor_tags.js` (84) | Java side of the tag layer: item and block tags from the live registries into one cached `HashSet` of Items; `reset()` per EMI generation |
| `emi_curation/ui/mods/mods_layout.js` (48) | pure dropdown geometry, no Java: `layoutMenu`, `paginate`/`layoutPaged` (pages plus the Prev/Next strip), `shiftClear`, `inside` |
| `emi_curation/ui/mods/mods_source.js` (49) | the Mods menu's entries: namespaces owning a stack of the current index, `Platform` names, overrides from `mods.json`; cached per index list |
| `emi_curation/ui/mods/mods_list.js` (47) | pure Mods menu data logic, no Java: `parseOverrides`, `buildEntries` (A-Z, rename, hide, pin), `nextSearch` |
| `emi_curation/decor/decor_local.js` (88) | pure local DECOR marks: parse/serialize `decor-local.json`, `lookup` (item mark, then mod mark, else null), the automatic/decor/not-decor `cycle*`, `load`/`mark` over an injected IO, and `kubeIo()` (KubeJS `JsonIO`) |
| `emi_curation/ui/decor_mark.js` (43) | the mark-as-decor key: Forge `KeyPressed.Pre` listener, hovered item from EMI (`emiScreen.hoveredEmiStack`) or the vanilla slot, toast, then `decorState.mark` and `session.refreshDecor()`. The key mapping comes from `kubejs/startup_scripts/emi_curation_keys.js` as `global.emiCurationDecorKey` (Forge accepts key mappings only at startup; without it this script logs once and does nothing). |
| `emi_curation/ui/decor_button.js` (44) | the DECOR: SHOWN/HIDDEN button (label from `decorState`; pressability and the toggle through `session.canPressDecor`/`toggleDecor`, which re-apply the index); loads after `button.js` and `mods_menu.js` so it settles beside them in one pass (Forge calls listeners in registration order) |
| `emi_curation/ui/mods/mods_text.js` (46) | the text layer: `draw(g, font, text, x, y, color)` via `drawWordWrap` and `width(text)` estimated from font metrics; never `drawString`/`Font.width` (see GOTCHAS) |
| `emi_curation/ui/mods/mods_menu.js` (45) | the Mods dropdown: state, handlers and wiring. Builds its rows from `mods_source`, pages them with `mods_layout`, places the button beside CLEAN/ALL (the `placement` rect registry), draws the rows in `Render.Post`, sets EMI's search text. Registered through `forge_hooks`. |
| `tools/emi_curation/tests/support/` (`harness.cjs`, `fake_emi.cjs`, `fixture.cjs`, `decor_world.cjs`) | Node harness that loads the production scripts (all subfolders) into a `vm` context in KubeJS priority order (plus `boot()`), a fake EMI/Java world to drive them, and the shared test world data (`fixture()`: named stacks and recipes) |
| `tools/emi_curation/tests/session.test.cjs`, `button.test.cjs`, `mods_menu.test.cjs`, `decor.test.cjs`, `decor_local.test.cjs` (shared world: `support/decor_world.cjs`), `interop.test.cjs` | session lifecycle and views; button placement and listeners; Mods menu behaviour, auto list, paging and pure logic; DECOR rules, toggle, persistence and button; Java list-copy handling |
| `tools/emi_curation/tests/policy.test.cjs`, `class_filter.test.cjs`, `emi_config.test.cjs` | policy rules (including the real curation lists), class filter, EMI config |
| `tools/server_smoke/smoke.cjs` | CLI: argument parsing, orchestration (setup, `--drop`, boot, or `--analyze` of a finished run) and printing the verdict |
| `tools/server_smoke/env.cjs` | the machine environment: java, packwiz bootstrap and installer jars, the Evil Eye Local mods folder (`LOCAL_MODS`), artifacts root, Forge version and URL; each overridable by a `SMOKE_*` env var |
| `tools/server_smoke/setup.cjs`, `procs.cjs` | cached Forge server install, `packwiz-installer -s server` install, `level-seed` (`--seed`, `readRunSeed`), `dropMods` (each install takes an optional process scope); hidden child processes: `procs.scope()` owns what it starts (`start`, bounded `run`, `killAll`), plus tree kill, JVM priority and CPU time (`setPriority`, `cpuSeconds`) |
| `tools/server_smoke/boot.cjs` | boot supervisor: spawn hidden, tee the console, raise JVM priority, wait for `Done (` (line-buffered) or a crash report under the progress watchdog; with `complete()`, keep waiting after Done for the caller's own completion (bounded by `completeTimeout`); `finally` stop and cleanup |
| `tools/server_smoke/cpu_sampler.cjs`, `shutdown.cjs` | one-in-flight CPU sampling with last-growth time; ending a boot: `stop` with grace, bounded jcmd thread dump, tree kill, scope cleanup, bounded log close |
| `tools/server_smoke/host_wait.cjs` | `waitForServer`: fail-closed wait (bounded, cancellable) until no other Minecraft JVM runs on the host; used by showcase checks and the mod map capture |
| `tools/server_smoke/watchdog.cjs` | pure watchdog decision (log silent AND CPU flat, hard cap) and CPU-per-wall starvation test |
| `tools/server_smoke/verdict.cjs` | pure PASS/STALL/HOST STARVED/FAIL decision (worldgen-stall classification) and crash-report parsing (mod name and failure message) |
| `tools/server_smoke/log_report.cjs`, `known_noise.json` | pure log grouping: errors and exceptions by signature, known boot noise vs new; the `DONE_RE` and `SPAWN_RE` regexes |
| `tools/dedup/guard.cjs` | duplicate-group allowance comparison (unexplained, changed, stale) shared by the cached-jar test and the pack test's live check |
| `tools/pack_test/run.cjs`, `analyze.cjs` | CLI and orchestration (verify, stage, scan, select target through `session/target`, analyse); offline analysis of a run folder: load evidence, run every check, write report/summary/candidate baseline |
| `tools/pack_test/recipe_json.cjs` | pure readers over recipe JSON (`ingredientRefs`, `declaredOutputRefs`, `declaredOutputs`, `isResourceId`); used by `session/resources` and the checks (including `snapshot`), so `session/` never depends on `checks/` |
| `tools/pack_test/stage_runtime.cjs` | neutral staged-server runtime policy: `WORLD`, `STAGE_RUNTIME` and `isStageRuntime(rel)` shared by local preparation, world caching and ANU sync |
| `tools/pack_test/session/` | before and during the boot: `prepare` (staged server, per-run copy with hard-linked jars, probe injection), `run_meta` (artifact-root guard, run id, what was tested), `world_cache` (world key, restore, save), `execute` (one boot until the probe manifest, evidence collection), `security` (pre-boot malware evidence), `resources` (raw data scan of the installed jars and KubeJS data, shipped-config scan and pre-boot scan/policy writer), `extract` (pure loot/worldgen references and lenient JSON), `target` (local/ANU choice, fallback and one starved shared-run retry), `lock` (local pid file lock), `aborts` (interrupt-callback registry with disposers) |
| `tools/pack_test/probe/` | KubeJS server scripts injected into the test server only: `registries` (registries, final tags, mods, loot tables), `recipes` (every live recipe normalized), `crafting` (FakePlayer crafts in a real crafting menu), `bootstrap` (sections, payloads, manifest last) |
| `tools/pack_test/checks/` | pure checks over the evidence: `recipes` (+ `conditions` evaluator), `references` (removed mods must not be loaded; required mods must be present), `acquisition`, `bees` (Productive Bees outputs), `machines`, `crafting`, `dedup`, `logs`, `security/` (malware today; future runtime-egress checks belong here); `snapshot` indexes probe registries/tags and recipe/bee products for the checks; each check builds findings with `verdict/finding` |
| `tools/pack_test/verdict/` | `protocol` (probe contract and validation), `baseline` (finding identity, new/known/resolved), `report` (report.json, summary.txt, exit code), `mode` (run mode label, starved-boot rule), `policy` (tool data, the acquisition exclusion policy, the pack config files copied as evidence), `finding` (`makeFinding(check)` and `sectionResult`, the one finding shape) |
| `tools/pack_test/remote/` | ANU target: `config`, `ssh` (encoded PowerShell over SSH, scp), `sync` (manifest-diff tar sync), `provision` (portable Node/JDK, README), `capacity` (alone/shared/fallback decision + read-only load probe), `lease/` (`dir_lock`: owner.json contract, stale rule incl. unreadable owners, PowerShell take/release, `{ runId, claimId }` lease values, `ownsLease` and atomic Node heartbeat; `lifecycle`: `startLease`, heartbeat and terminal stop/cleanup), `scripts` (launch, status, command-line-guarded kill PowerShell), `evidence` (pull the run's evidence home), `anu` (the sync, launch, poll, pull orchestrator), `agent` (runs on ANU with explicit job Java/jcmd and run/cache paths; lease loss kills owned children and exits 2) |
| `tools/pack_test/tests/` | `checks/`: pure evidence checks (including `malware.test.cjs`) and recipe/bee product indexing; `data/pack_contract.test.cjs`: real pack metafiles, policy and Hourglass config pins; `remote/`: `dir_lock.test.cjs`, capacity, sync, lease lifecycle and guarded process cleanup; `verdict/`: protocol, baseline, finding and report; `session/`: locks, `jar_walk.test.cjs`, resource extraction, boot lifecycle and target sequencing. Run all five with `node --test tools/pack_test/tests/*/*.cjs`. |
| `tools/dedup/catalog.cjs`, `generate.cjs`, `overrides.cjs`, `hidden_reasons.json` | `catalog`: scan of the pinned jars (duplicate groups); `generate`: writes `kubejs/data/<mod>/` overrides and the EMI removals from `dedup.json` after a jar change, never downloads; `overrides`: computes `dedup.json` block-tag removals and data-only patches for custom serializers (counts, chances, conditions kept); `hidden_reasons.json`: one recorded reason per `hiddenOnly` id (guarded by its test) |
| `tools/emi_coverage/scan_jars.cjs` | read-only scan of mod jars for viewer plugin coverage using data_io's ZIP reader |
| `tools/data_io/zip_reader.cjs` | dependency-free ZIP entry listing and decompression; shared by coverage and jar traversal |
| `tools/data_io/walk.cjs` | ordered jar traversal, optional jarjar recursion, caller-owned selection and parsing |
| `tools/data_io/files.cjs` | strict JSON file reading (`readJson`) and byte SHA-256 (`sha256`) |
| `tools/dedup/policy.cjs` | ordered retired ids for Node consumers; shipped KubeJS mirror pinned by `tests/policy.test.cjs` |

[Architecture](docs/ARCHITECTURE.md) maps the automated pack-test flow;
[EMI](docs/emi.md) is the architecture doc for the EMI subsystem.

KubeJS loads client scripts in descending `// priority:` order. Each script adds one
namespace to `global.emiCuration`. Only `session.js` (through `ClientEvents`), `ui/button.js`, `ui/mods/mods_menu.js`, `ui/decor_button.js` and `ui/decor_mark.js` (through `ui/forge_hooks.js`) register event
handlers.

## Dependencies

- The curation scripts depend on **EMI internals** (`EmiStackList`, `EmiRecipes.manager`, `EmiSearch`, `EmiScreenManager`, `EmiReloadManager`, `EmiHidden`). Those are confined to `index_view.js` (also its `EmiScreenManager` refresh), `recipe_view.js`, `hiding.js` (`EmiHidden`), `session.js` (`EmiReloadManager`) and `ui/emi_screen.js` (the `EmiScreenManager` search widget and hover lookups; `placement.js`, `mods_menu.js` and `decor_mark.js` go through it). EMI is pinned to 1.1.24+1.20.1+forge, so re-verify these before changing its version.
- JEI must stay installed: EMI's JEMI bridge only loads JEI plugins when JEI is present.
- `tools/pack_test/session/resources.cjs` depends on `verdict/policy.cjs` for the pack config files copied as evidence.
- Node sleeps use `node:timers/promises`; process priority/CPU queries require an explicit owning scope.
- Tooling needs Node 22 and git (`rehash.cjs` lists files with `git ls-files`). There is no packwiz CLI, Python or build step.
- The installer is `packwiz-installer-bootstrap.jar` in `C:/Users/dirty/MultiMC/packwiz/`, outside the repo. See `docs/development.md`.
- The pack test needs `ssh`/`scp`/`tar` on Valhalla for its ANU target, and on ANU only what `remote/provision.cjs` installs under `C:\Tools\evil-eye-pack`.

## Structural debt

Baseline review 2026-10-12. Remaining debt is filed in Docket (`docs/items/`, `dk list`):

- The EMI views rely on public-but-internal EMI fields. A custom mod would avoid that but would need building and hosting. Rejected for now; see `docs/DECISIONS.md`.

Last full review: 2026-10-12
