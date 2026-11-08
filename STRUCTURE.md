# Structure

A packwiz modpack (Minecraft 1.21.1, NeoForge 21.1.265, Java 21; migrated from Forge 1.20.1, see `docs/neoforge-migration.md`). The repository holds packwiz
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
|   `-- evil-eye-cozy-overrides/
|-- shaderpacks/
|-- scripts/
|   |-- diagnostics/
|   |-- instances/
|   |-- migration/
|   |-- mod-map/
|   `-- owner/
`-- tools/
    |-- analysis/
    |   |-- consolidation/
    |   |   `-- tests/
    |   |-- dedup/
    |   |   `-- tests/
    |   |-- emi_coverage/
    |   |-- emi_curation/
    |   |   `-- tests/
    |   |       `-- support/
    |   |-- library_closure/
    |   |   `-- tests/
    |   |-- malware_guard/
    |   |   |-- data/
    |   |   |-- scanning/
    |   |   `-- tests/
    |   `-- mod_map/
    |       |-- capture/
    |       |-- inventory/
    |       |-- model/
    |       |-- page/
    |       `-- tests/
    |           |-- capture/
    |           |-- inventory/
    |           |-- model/
    |           `-- page/
    |-- data_io/
    |   `-- tests/
    |-- packwiz/
    |   |-- install/
    |   |-- migration/
    |   |   `-- deferred/
    |   `-- tests/
    |-- runtime_env/
    |-- script-run/
    `-- testing/
        |-- client_mixin/
        |   |-- probe/
        |   `-- tests/
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
        |   |   |-- data/
        |   |   |-- remote/
        |   |   |-- session/
        |   |   `-- verdict/
        |   `-- verdict/
        |-- server_smoke/
        |   |-- process/
        |   |-- runtime/
        |   `-- tests/
        |-- showcase/
        |   |-- checks/
        |   `-- tests/
        `-- world_trial/
            |-- probe/
            `-- tests/
```

- `pack.toml` — pack definition; its `[index]` hash is sha256 of `index.toml`
- `index.toml` — every installed file with its sha256; runtime-rewritten settings carry `preserve = true` (rebuild with `tools/packwiz/rehash.cjs`)
- `mods/` — packwiz metafiles (`*.pw.toml`), one per mod jar (CurseForge, Modrinth, direct URL, or private migration `metadata:local` hash pins)
- `shaderpacks/` — shaderpack metafiles and saved shader options
- `resourcepacks/` — resource pack metafiles (`*.pw.toml`) installed into the instance
- `resourcepacks/evil-eye-cozy-overrides/` — top-priority thirst, legacy silver, Curios GUI assets; CozyUI+ owns HUD hearts, with no `gui/sprites/hud/heart/` folder in this override; `assets/.../gui/sprites/` is intentionally flat. Selection policy lives in `config/evileye_client/resourcepacks.json`; the pack data contract guards both.
- `config/` — mod configs installed as plain files
- `config/modernui/client.toml` - enables Modern UI zoom; its Z default is in `config/defaultoptions/keybindings.txt`.
- `config/defaultoptions/keybindings.txt` — default keymap applied by Evil Eye Client (Default Options syntax; new instances and unsaved keys only; see GOTCHAS)
- `config/evileye_client/resourcepacks.json` — first-launch resource-pack order and required/force-compatible packs, read by Evil Eye Client
- `config/emi-curation/` — EMI curation data: `rules.json`, seven explicit item lists (including `roundwood-legacy.json`, `alexsmobs-creative.json` and `iceandfire-creative.json`), `decor.json` (the DECOR toggle's rules), `mods.json` (Mods menu overrides: rename, hide, pin); the owner's `decor-local.json` is created in game and never shipped
- `kubejs/client_scripts/emi_curation/` — client scripts for the curated EMI views (diagnostics, collections, policy, interop, bounded index construction, views, hiding, session)
- `kubejs/client_scripts/emi_curation/decor/` — the DECOR rules: pure policy, the local marks (`decor_local.js`) and the Java tag adapter
- `kubejs/client_scripts/emi_curation/ui/` — the CLEAN/ALL button, the DECOR button, the mark-as-decor key handler and shared UI infrastructure (placement, Forge listener registration). KubeJS loads subfolders and sorts the whole pack by priority, so folders do not change load order.
- `kubejs/client_scripts/emi_curation/ui/mods/` — Mods dropdown, source entries, layout, list policy and text drawing.
- `kubejs/startup_scripts/` — `globals.js` creates the shared `global.emiCuration` and `global.evilEyeShowcase` namespaces (KubeJS 2101 lets only startup scripts set `global` values); `emi_curation_keys.js` registers the "EMI Curation" key mapping through `NativeEvents` (mod-bus, startup only); `kubejs/assets/emi_curation/lang/` names it
- `kubejs/server_scripts/showcase/` — bounded plans, multi-section layout, plot records, staged construction, entity policy, control dispatch and commands; `sections/` holds pure content factories, and `rigs/` owns section-specific validation and world mechanics.
- `kubejs/server_scripts/dedup.js` — permanent duplicate recipe/tag cleanup; no stack conversion. Survivor choices: `docs/duplicate-cleanup.md`.
- `kubejs/config/dedup.json` — authored duplicate policy; the generator never writes this input.
- `kubejs/config/dedup_sources.json` — generated recipe removals, survivor tags and block-tag removals derived from pinned jar block loot tables.
- `kubejs/data/*/recipes/`, `kubejs/data/*/loot_tables/` — generated dedup overrides alongside hand-written data recipes.
- `kubejs/assets/emi/index/stacks/dedup.json` — generated permanent EMI removals.
- `kubejs/data/curios/curios/slots/<id>.json` — one `{"add_cosmetic": true}` file per curio slot type (enables the Cosmetics tab slots); guarded by `tools/testing/pack_test/tests/data/curios_cosmetic_slots.test.cjs`, which derives the ids from the pinned jars.
- `kubejs/data/` — hand-written and generated data overrides (recipes, loot tables, tags), one folder per owning mod (`kubejs/data/<mod>/...`); flat by design, one folder per mod that has an override. On the NeoForge branch it also restores 1.21-path copies of data mods ship only in 1.20 folders (MCA, Citadel, Waddles, Interiors, three block tags; see `docs/neoforge-migration.md`)
- `kubejs/assets/emi/` — EMI resource overrides; today only `index/stacks/` (permanent EMI removals written by the dedup generator)
- `tools/data_io/` — shared Node data I/O: ZIP reading, ordered jar traversal, strict JSON file reading and byte hashing (`hashBytes`, `sha256`), and `path_guard.cjs`, the shared no-link / containment / protected-output guard used by world_trial, client_mixin and the installers.
- `tools/testing/` — tools that boot or exercise the pack: `client_mixin/`, `world_trial/`, `server_smoke/`, `pack_test/`, `showcase/`.
- `tools/runtime_env/` — shared machine environment (`env.cjs`: Java per major, packwiz jars, artifacts root; `FIXED` ignores `SMOKE_*` overrides, used by the install route) and hidden child-process scopes (`procs.cjs`); imported by `testing/`, `analysis/` and `packwiz/`.
- `tools/analysis/` — tools that read the pack's files and jars without booting it: `dedup/`, `emi_curation/` (tests), `emi_coverage/`, `mod_map/`, `malware_guard/`, `library_closure/`, `consolidation/`.
- `tools/testing/client_mixin/` — offline CLIENT mixin audit: `stage.cjs` copies pinned pack files and cached
    client libraries, `run.cjs` compiles and supervises the bounded JVM, `verdict.cjs` rejects incomplete
    evidence, and `allowlist.json` records exact reviewed findings with reasons and separately tagged
    Docket-backed known-minor exceptions.
    `probe/ClientMixinLaunch.java` uses NeoForge's production client discovery and transformer without
    entering Minecraft's main method; `tests/` covers staging arguments, allow-list validation and verdicts.
- `tools/testing/world_trial/` — guarded independent snapshots (`copy.cjs`, `snapshot.cjs`), offline
  NBT/region inventories (`nbt.cjs`, `inventory.cjs`, domain views in `semantics.cjs`), conservative semantic comparison
  (`compare.cjs`) and isolated headless boot/restart (`boot.cjs`, `probe/`). `run.cjs` is
  the CLI; tests cover path isolation, manifests, NBT and storage/ownership loss.
- `tools/analysis/mod_map/` — offline mod map. `build.mjs` (entry) and `run.cjs` (orchestration, artifact guards, saved-evidence replay) at the top; `inventory/` pinned-jar inventory and the `mods.toml`-only reader; `model/` dependency graph, classification, cost, families, categories and their checked-in data (`overrides.json` reasoned kind/family corrections, undeclared dependencies and pack-wide fixes; `categories.json` family/standalone ID → category); `capture/` the one-boot instrumented capture and TRACE timing; `page/` the pure view, HTML builders, document shell, CSS and browser controls. `tests/` mirrors those folders; `tests/fixtures.cjs` is a shared helper outside the `*/*.test.cjs` glob.
- `scripts/` — owner-run PowerShell entry points, one `scripts/<area>/<verb>.ps1` per owner command (areas: mod-map, migration, owner, diagnostics, instances); Node tooling sits underneath in `tools/`. Scripts and their logs (ignored `.tmp/`) are packwiz-excluded.
- `scripts/instances/` — `local-instance.ps1`, the Evil Eye Local create/refresh entry point (`-Create` builds the instance; as Local's PreLaunchCommand it reinstalls the main checkout through `local_target.cjs`).
- `scripts/diagnostics/` — `capture-freeze.ps1`, two `jstack` thread dumps of a hung Stable client into the artifacts job folder.
- `scripts/mod-map/` — `build.ps1`, the mod map owner entry point (wraps `tools/analysis/mod_map/build.mjs`).
- `scripts/migration/` — owner entry points for the NeoForge cutover: `trial-walkthrough.ps1` (offline installer for Evil Eye NeoForge Trial), `cutover.ps1` / `rollback.ps1` / `stable-prelaunch.ps1` for Stable, and `cutover-lib.ps1`, their shared guards and archive plumbing.
- `scripts/owner/` — `owner-run.ps1`, the verbatim owner-run 1.0.0 template every owner script dot-sources (logging, OK/FAILED line).
- `tools/script-run/` — the verbatim Node script-run 1.1.0 template (`script-run.mjs`) and its test from `~/.claude/templates/scripts/`; Node entry points such as `tools/analysis/mod_map/build.mjs` run through it.
- `tools/analysis/malware_guard/` — offline content scanner, instance drift and metadata source/known-bad gate; opt-in cached Modrinth status, approval CLI, `data/` policies and synthetic `tests/`. Local reports/cache are ignored under `.local/`.
- `tools/analysis/dedup/` — pinned cached-jar scanner, data override generator, duplicate-material guard and tests; `allowed_groups.json` records narrow exceptions; `hidden_reasons.json` holds the reason for every `hiddenOnly` id (see docs/development.md "Known exceptions registry").
- `tools/analysis/emi_curation/` — unshipped: Node tests for the curation scripts (`tests/`)
- `tools/analysis/malware_guard/tests/`, `tools/packwiz/tests/`, `tools/testing/server_smoke/tests/`, `tools/testing/pack_test/tests/`, `tools/testing/showcase/tests/`, `tools/analysis/mod_map/tests/`, `tools/script-run/` — Node test suites, run together with the `tools/analysis/emi_curation/tests/` ones (`node --test tools/analysis/malware_guard/tests/*.test.cjs tools/analysis/dedup/tests/*.cjs tools/packwiz/tests/*.cjs tools/analysis/emi_curation/tests/*.cjs tools/testing/server_smoke/tests/*.cjs tools/testing/pack_test/tests/*/*.cjs tools/testing/showcase/tests/*.cjs tools/analysis/mod_map/tests/*/*.test.cjs tools/script-run/*.test.mjs tools/data_io/tests/*.cjs tools/testing/world_trial/tests/*.cjs tools/testing/client_mixin/tests/*.cjs tools/analysis/library_closure/tests/*.test.cjs tools/analysis/consolidation/tests/*.test.cjs`)
- `tools/analysis/emi_coverage/` — unshipped: read-only jar scanner for viewer plugin coverage
- `tools/testing/showcase/` — offline headless runner, probe lifecycle, assertion helpers, shared terrain and registry-wide command checks; `checks/` holds section behaviour checks and `tests/` the focused Node VM/runner tests.
- `tools/testing/server_smoke/` — unshipped: headless server compatibility smoke (NeoForge 1.21.1 runtime from `pack.toml`) (`smoke.cjs`), with `verdict.cjs`, `log_report.cjs` and `known_noise.json` at the top; `process/` (boot supervisor, shutdown, CPU sampler, progress watchdog, host wait) and `runtime/` (runtime descriptor, loader base and pack install, pinned offline server preparation).
- `tools/testing/pack_test/` — unshipped: one-boot automated pack test (`run.cjs` and `analyze.cjs`); `recipe_json.cjs`, `stage_runtime.cjs`, `session/`, `checks/` (including security checks in `checks/security/`), `verdict/`, `probe/`, `remote/` (with the `lease/` cluster), `data/`, `tests/`. See the Components table below for module responsibilities; `data/` holds baseline, crafts, machines and policy JSON (`policy.json` carries `removedMods` and `requiredMods`); `tests/` mirrors the source with `checks/`, `data/`, `remote/`, `verdict/` and `session/`.
- `tools/packwiz/` — unshipped: hash-chain verifier, index rebuild, localhost pack server, tests; `install/` holds the neutral local-copy install route (including strict plain-file drift restoration and retained backups) and its Trial, Stable and Local targets, `migration/` the NeoForge migration lock tooling.
- `docs/` — unshipped living docs (development workflow, decisions, gotchas, EMI guide and integration coverage)
- `docs/items/`, `docket.json` — Docket work-item store (use `dk`); `AGENTS.md` — agent instructions. All unshipped.

- `tools/analysis/library_closure/` — owns recursive pinned-jar closure: `scan.cjs` follows every nested jar with full archive paths and `class_references.cjs` reads constant-pool strings conservatively. `targets.cjs` owns candidate profiles and physical-removal verdicts. `run.mjs` is the artifact-only script-run CLI; `tests/` covers arbitrary nesting, duplicate providers, dependencies, malformed/truncated inputs and incomplete scans.

- `tools/analysis/consolidation/` — `run.mjs` verifies an existing world-trial snapshot and writes artifact-only wave-7 evidence; `wave7_evidence.cjs` interprets candidate payloads through the world-trial inventory visitor. `tests/` covers historical/new selections, packed versus unused palette entries, structures, train/player payloads, large quantities and incomplete inputs. It never converts a save or certifies native runtime parity.

- `tools/testing/world_trial/inventory.cjs` exposes a `visit` hook used by `tools/analysis/consolidation/wave7_evidence.cjs`.

## Components

Showcase layout and extension guide: [docs/showcases.md](docs/showcases.md).

| Component | Responsibility |
|---|---|
| `tools/analysis/library_closure/scan.cjs` | recursive pinned-jar closure with full nested archive paths |
| `tools/analysis/library_closure/class_references.cjs` | conservative constant-pool string references |
| `tools/analysis/library_closure/targets.cjs` | candidate profiles and physical-removal verdicts |
| `tools/analysis/consolidation/wave7_evidence.cjs` | candidate payload interpretation through the world-trial inventory visitor |
| `tools/data_io/path_guard.cjs` | shared containment, no-link and protected-output guards; `artifactJob(dir)` owns the artifact-jobs root and containment rule |
| `kubejs/server_scripts/showcase/plan.js` | pure plan bounds, shared floor, placement/sign helpers, registry, rig dispatch and multi-section layout/source-to-origin math |
| `kubejs/server_scripts/showcase/sections/*.js` | one self-registering content plan per section; no world access |
| `kubejs/server_scripts/showcase/plots.js` | persistent records, plot keys, overlap replacement and serialized rig ownership |
| `kubejs/server_scripts/showcase/construction.js` | read-only preflight, then teardown/reserve/place/finish stages; generic world writes and rig hooks |
| `kubejs/server_scripts/showcase/rigs/create_contraption.js` | Create descriptor validation, glue boundary/entity policy, motor zeroing, bearing teardown, collision preparation and lever control; legacy record compatibility |
| `kubejs/server_scripts/showcase/entities.js` | entity policy for clearing: discard ordinary, block on player/tamed/named |
| `kubejs/server_scripts/showcase/controls.js`, `command.js` | record-only rig tick dispatch and op-only command tree |
| `tools/testing/showcase/check.cjs` | one-boot showcase CLI and reports/log comparison; uses the neutral offline-server preparer with the flat `showcase` profile |
| `tools/testing/server_smoke/runtime/offline_server.cjs` | pinned offline server preparation (through `packwiz/pinned_jar.cjs`) with `showcase` (flat, no spawns) and `ordinary` world profiles; shared by showcase and mod-map capture using existing pack-test setup |
| `tools/analysis/mod_map/run.cjs`, `build.mjs` | mod map orchestration: options, artifact and read-only-input guards, saved-evidence identity checks, inventory → model → capture/timing → page; `build.mjs` runs it through script-run |
| `tools/analysis/mod_map/inventory/inventory.cjs` | pinned jars → nodes with bundle reconciliation, reading jar metadata through `data_io/mod_metadata.cjs` |
| `tools/data_io/mod_metadata.cjs` | the one Forge `mods.toml` / NeoForge `neoforge.mods.toml` scalar reader: mods, versions (`${file.jarVersion}` from the manifest), dependency `type` (`required`/`optional`/`incompatible`/`discouraged`; Forge `mandatory` maps onto it) and declared jar-in-jar traversal (`readJarMods`); metafiles use `pack_index` `readTable` |
| `tools/analysis/mod_map/model/` (`graph.cjs`, `classify.cjs`, `cost.cjs`, `families.cjs`, `categories.cjs`) | mandatory edges to physical jars; per-mod kind with evidence and the one `isLibrary(classifications, node)`; measured cost per unique mod ID; families by root selection, content membership and library ownership; purpose categories from `categories.json` |
| `tools/analysis/mod_map/capture/` (`capture.cjs`, `timing.cjs`) | one local offline boot with a narrow FML TRACE log4j config and a registry snapshot; pairing TRACE intervals before `DONE_RE` |
| `tools/analysis/mod_map/page/` (`view.cjs`, `html.cjs`, `document.cjs`, `page.css`, `page.js`) | pure view derivation (ranking, trees, cards) over finished data; escaped HTML fragments; the self-contained document shell; styles and browser-only controls |
| `tools/testing/showcase/harness.js`, `helpers.js` | probe sequencing/lifecycle/completion; `makeHelpers` supplies fixture access and plan/volume assertions |
| `tools/testing/showcase/command_forms.js`, `terrain.js`, `checks/*.js`, `tests/*.cjs` | one registry-wide command check per boot; shared hostile terrain checks; section-specific behaviour checks and focused Node tests |
| `tools/analysis/malware_guard/cli.cjs` | `scan`, `drift`, `gate`, explicit online `status` and hash-based `approve`; applies approvals once to raw reports before JSON output and exits 0/1/2 |
| `tools/analysis/malware_guard/scanning/` (`scan.cjs`, `signatures.cjs`) | bounded recursive archive/folder scan using shared byte jar traversal; entry hashes, class signatures and tunable loader co-occurrence heuristics |
| `tools/analysis/malware_guard/metadata.cjs` | packwiz installed-path inventory and expected pinned hashes |
| `tools/analysis/malware_guard/tests/*.test.cjs` | synthetic scanning, signature validation, approval identity, metadata/drift and injected status tests; `fixtures.cjs` is a helper excluded by the test glob |
| `tools/analysis/malware_guard/drift.cjs`, `gate.cjs` | instance drift over the inventory expected map; source/hash validation, URL identities and known-bad matching |
| `tools/analysis/malware_guard/policy.cjs`, `status.cjs`, `data/` | finding and owner approval kinds with shared keys and report application; separate injected HTTP/cache client; allowlist, owner-added hashes, known-bad projects, validated signature patterns and heuristic limits |
| `tools/testing/pack_test/session/security.cjs` | collect raw reports with explicit scan/gate/drift kinds before boot; write malware.json without policy |
| `tools/testing/pack_test/checks/ignored_layout.cjs` | sort mod data shipped only in the other Minecraft version's folders into covered / reasoned (policy `ignoredLayout`) / lost; used by the references check and the pinned-jar data test |
| `tools/testing/pack_test/checks/security/malware.cjs` | read raw or legacy evidence and apply current approvals once into the offline malware section |
| `kubejs/server_scripts/dedup.js` | applies authored dedup policy and generated recipe/tag cleanup; hand-written server recipes go in a script named for the concern, not dedup.js |
| `kubejs/server_scripts/tag_compat.js` | item tag aliases for mods that name tags the 1.21.1 target lacks (Create: Interiors `c:<colour>_dyes`, Create's item `#minecraft:convertable_to_mud`) |
| `tools/packwiz/pack_index.cjs` | index/pack TOML parse and format (including the runtime-rewritten setting `preserve` policy; `readTable` reads string tables and numeric CurseForge IDs; metafile name/download/side readers share the model), `isMetafile`, `.packwizignore`, `publishableFiles()` (the one publishable-file set used by rehash and verify) |
| `tools/packwiz/pinned_jar.cjs` | `resolvePinnedJar(metafileText, dirs)`: the one pinned-jar lookup (safe filename, ordered folders, hash-verified bytes, fail closed, never downloads); used by offline server preparation and the mod map inventory |
| `tools/packwiz/install/install_pack.cjs` | the neutral install route (no instance rules): verifies cache pins, indexes artifacts as ordinary local files in a temporary pack, runs the cached headless installer, verifies every non-preserve installed hash (including all mod jars), applies the owned keys and sets the target's prelaunch; no host or downloads. Also `prepareFiles`, `writePack`, `verifyInstalledFiles`, `setInstanceCfgValue` |
| `tools/packwiz/install/instance_targets.cjs` | the one authority for which MultiMC instance is which (real Stable path, Local/Trial names, forbidden sets): `stableTarget`, `trialTarget`, `assertPinTarget`, `isRealStable`, `allowedAsStable` (the pure allowlist: real Stable or a path outside the MultiMC instances folder; `stableTarget` enforces it), and `classify <path>` / `stable` CLI commands that `cutover-lib.ps1` calls |
| `tools/packwiz/install/trial_target.cjs`, `stable_target.cjs` | thin targets of `installPack`: Trial (only Evil Eye NeoForge Trial; entry for `trial-walkthrough.ps1`) and Stable (real Stable or a rehearsal copy, `--fresh` clean-start of old tracked files; entry for `cutover.ps1` and `stable-prelaunch.ps1`), each with its own prelaunch command |
| `tools/packwiz/install/local_source.cjs`, `install_local.cjs` | private migration pins: `local_source.cjs` verifies hash-addressed cache bytes and creates the temporary loopback installer overlay (server smoke and pack-test staging share it); `install_local.cjs` is the dedicated trial prelaunch wrapper. Public delivery is separate (dk-85261627); see [NeoForge migration](docs/neoforge-migration.md) |
| `tools/testing/world_trial/probe/` | the trial-server probe: `plan.cjs` chooses what to visit from the offline inventory (stored stacks, named/owned entities, dragon, colonies, sampled terrain); `capture.js` (one forced chunk at a time) and `players.js` (real player-data load/save with the original UUID) are injected as KubeJS server scripts by `boot.cjs` and write the capture the comparison reads |
| `tools/packwiz/install/local_target.cjs`, `scripts/instances/local-instance.ps1` | Evil Eye Local only: `--create`/`-Create` builds the instance from Stable's cfg (name changed, play history dropped, no saves) and installs main through the cache route; the prelaunch repeats it from the main checkout |
| `scripts/migration/cutover.ps1`, `rollback.ps1` | owner-run Stable cutover (dry run by default: guards, archive plan, pack/cache verification; `-Execute` archives with a SHA-256 manifest, then installs) and its restore from the archive; both refuse Local/Trial and any other MultiMC instance through `Assert-NotLocalOrTrial` / `Assert-StableInstance`, and default `-Instance` from the authority |
| `scripts/migration/cutover-lib.ps1` | shared functions only: launcher blockers, archive space/files/manifest/restore, `Set-CfgKey`, `Set-InstanceNeoForge` (mmc-pack.json + Java keys), and `Get-InstanceTarget` / `Test-RealStable` / `Assert-NotLocalOrTrial` / `Assert-StableInstance` / `Get-StableInstancePath`, which delegate to `instance_targets.cjs` |
| `scripts/migration/stable-prelaunch.ps1` | Stable's PreLaunchCommand: repeats the verified private-jar install into Stable on every launch through `stable_target.cjs` |
| `tools/packwiz/install/pack_owned_keys.cjs` | Forces the keys in `pack-owned-keys.json` into the installed (including preserved) configs of Trial and Stable after each sync; JSON and TOML setters |
| `tools/packwiz/rehash.cjs` | rebuild `index.toml` membership and hashes, then `pack.toml`'s index hash |
| `tools/packwiz/migration/migrate.mjs`, `migration/run.cjs` | NeoForge migration CLI through script-run: `resolve` (build the lock), `check` (offline lock/cache/closure verification), `apply` (re-point; dry run unless `--write`) |
| `tools/packwiz/migration/resolve.cjs` | survey + dispositions + source metafiles → one selector per entry (never guesses a file) |
| `tools/packwiz/migration/fetch.cjs` | platform identity and publisher-verified bytes: Modrinth sha1/sha512, CurseForge length + CDN MD5 via the site's download redirect, GitHub asset sha256 digest, NeoForge Maven `.sha256`; raw API JSON cached in the job folder |
| `tools/packwiz/migration/manifest.cjs` | the lock contract: source fingerprint, canonical serialization, exactly-once coverage and per-action/source validation |
| `tools/packwiz/migration/dependencies.cjs` | Maven ComparableVersion ranges, FML's 1.21.1 VersionSupportMatrix, and the closure check (required/optional/incompatible/discouraged, sides, duplicate providers, Forge-only jars) |
| `tools/packwiz/migration/repoint.cjs` | packwiz-layout metafile rendering, the full write/delete plan with `pack.toml [versions]`, all-or-nothing apply with rollback; `planApplied` updates an already-applied checkout to a changed lock |
| `tools/packwiz/migration/source_tree.cjs` | after apply, export the lock's recorded source commit (fingerprint-checked) so `resolve` re-reads the original metafiles |
| `tools/packwiz/migration/{dispositions,target-lock}.json` | reviewed per-entry decisions, additions, provisional pins and waivers; the generated lock (unshipped: `tools/` is packwiz-ignored) |
| `tools/packwiz/verify_hashes.cjs` | check the hash chain, index membership and optionally jar hashes |
| `tools/packwiz/serve.cjs` | serve the containing checkout on `127.0.0.1` over HTTP (not used by MultiMC: local instances install from the file path) |
| `emi_curation/diagnostics.js` (priority 100) | guarded logging; nothing may throw into Forge or EMI |
| `emi_curation/collections.js` (95) | pure `len`/`at` accessors for JS arrays and Java lists, plus `ns.ids.split`/`namespaceOf` for resource ids; shared by policy, views, hiding, DECOR and Mods |
| `emi_curation/policy.js` (90) | parse and validate the curation JSON into one `nbtRules` map. Stack (id, `nbtExceptions` keep, `hideWhenNbtHasKey` hide) and REI display-rule predicates. Pure: no Java, no EMI mutation or classification cache; `classifyId` returns a verdict consumed by `verdictHidden`. |
| `emi_curation/java_interop.js` (85) | class lookup, `isContainerScreen`/`literal` (shared by both buttons), warning-free Java reference identity, Java list copy/freeze, list filtering (`filterToList`), item-key test (`isItemKey`), `EmiStack` → policy descriptor (1.20 NBT or encoded 1.21 component patch) |
| `emi_curation/index_view.js` (80) | swap `EmiStackList.filteredStacks` between EMI's list and the CLEAN copy, read back the post-coercion Java field identity, then refresh search and sidebars. No hide decisions. |
| `emi_curation/index_build.js` (75) | snapshot one index source, classify at most 256 stacks or 4 ms per tick into private output, then freeze the complete ordered view for one atomic publication; stale generations are discarded |
| `emi_curation/recipe_view.js` (70) | JS `EmiRecipeManager` wrapper and its lifecycle: persistent `recipeState`, `viewFor`/`unwrap`, generation sync, reload token, Java proxy cache, apply/restore/release/reset; filters displays |
| `emi_curation/hiding.js` (65) | the single home of hide decisions: `configure({ policy, getMaster })` (called once by `session.js`), then pack policy per stack (the single classification cache holds verdicts per registry key; DECOR is decided in `decor_state.js`, never here) and REI-style display hiding (adds EMI's user-hidden set and the master-index key set, built and cached here) |
| `emi_curation/decor/decor_state.js` (62) | the single home of DECOR state: loads `decor.json` and `decor-local.json`, holds the local-marks holder, the per-key classification cache and tag-set reset behind one `invalidate()`, `isHidden(stack)`, the SHOWN/HIDDEN mode override (`flip`/`setOverride`/`resetMode`, in `global.emiCuration.decorMode`), `label()` and `mark(id, wholeMod)`. Never feeds recipe displays. |
| `emi_curation/session.js` (60) | CLEAN/ALL state in `global`, loads the policy (and calls `decorState.load`), configures `hiding.js`, combines CLEAN/ALL x DECOR into the index view key, EMI generation tracking, tick → sync → sliced build → atomic apply with restore on failure, reload/logout handling, event registration |
| `emi_curation/ui/native_hooks.js` (58) | `register(table, hooks)`: NeoForge listeners through KubeJS 2101's reloadable `NativeEvents` (no once-per-launch guard; client scripts may not set `global` values), dispatching through a reloadable `global.emiCuration[table]` handler table; handler errors are logged, never rethrown. `EVENTS` is the NeoForge client event package. Used by `screen_button.js`, `mods_menu.js` and `decor_mark.js`; `session.js` uses `ClientEvents`. |
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
| `emi_curation/ui/mods/mods_menu.js` (45) | the Mods dropdown: state, handlers and wiring. Builds its rows from `mods_source`, pages them with `mods_layout`, places the button beside CLEAN/ALL (the `placement` rect registry), draws the rows in `Render.Post`, sets EMI's search text. Registered through `native_hooks`. |
| `tools/analysis/emi_curation/tests/support/` (`harness.cjs`, `fake_emi.cjs`, `fixture.cjs`, `decor_world.cjs`) | Node harness that loads the production scripts (all subfolders) into a `vm` context in KubeJS priority order (plus `boot()`), a fake EMI/Java world to drive them, and the shared test world data (`fixture()`: named stacks and recipes) |
| `tools/analysis/emi_curation/tests/session.test.cjs`, `button.test.cjs`, `mods_menu.test.cjs`, `decor.test.cjs`, `decor_local.test.cjs` (shared world: `support/decor_world.cjs`), `interop.test.cjs` | session lifecycle and views; button placement and listeners; Mods menu behaviour, auto list, paging and pure logic; DECOR rules, toggle, persistence and button; Java list-copy handling |
| `tools/analysis/emi_curation/tests/policy.test.cjs`, `class_filter.test.cjs`, `emi_config.test.cjs` | policy rules (including the real curation lists), class filter, EMI config |
| `tools/testing/server_smoke/smoke.cjs` | CLI: argument parsing, orchestration (setup, `--drop`, boot, or `--analyze` of a finished run) and printing the verdict |
| `tools/runtime_env/env.cjs` | the machine environment: Java/jcmd per major (`JAVAS`), packwiz bootstrap and installer jars, the Evil Eye Local mods folder (`LOCAL_MODS`), artifacts root, optional installer URL; each overridable by a `SMOKE_*` env var in the exported values; `FIXED` is the same set with no overrides, for the install route. No loader versions: those come from `pack.toml` |
| `tools/testing/server_smoke/runtime/runtime.cjs` | the runtime descriptor from `pack.toml [versions]` (exactly one supported loader: Forge 1.20.1 or NeoForge 1.21.1), its Java major, installer, checksum kind and argument file, the `id` that keys bases/stages/worlds/ANU lanes, Java verification and `runtime.json` stamps |
| `tools/testing/server_smoke/runtime/setup.cjs`, `tools/runtime_env/procs.cjs` | cached per-runtime loader base (`loader-base/<id>`, checksum-verified installer, stamped), `packwiz-installer -s server` install, `level-seed` (`--seed`, `readRunSeed`), `dropMods` (each install takes an optional process scope); hidden child processes: `procs.scope()` owns what it starts (`start`, bounded `run`, `killAll`), plus tree kill, JVM priority and CPU time (`setPriority`, `cpuSeconds`) |
| `tools/testing/server_smoke/process/boot.cjs` | boot supervisor: spawn hidden, tee the console, raise JVM priority, wait for `Done (` (line-buffered) or a crash report under the progress watchdog; with `complete()`, keep waiting after Done for the caller's own completion (bounded by `completeTimeout`); `finally` stop and cleanup |
| `tools/testing/server_smoke/process/cpu_sampler.cjs`, `shutdown.cjs` | one-in-flight CPU sampling with last-growth time; ending a boot: `stop` with grace, bounded jcmd thread dump, tree kill, scope cleanup, bounded log close |
| `tools/testing/server_smoke/process/host_wait.cjs` | `waitForServer`: fail-closed wait (bounded, cancellable) until no other Minecraft JVM runs on the host; used by showcase checks and the mod map capture |
| `tools/testing/server_smoke/process/watchdog.cjs` | pure watchdog decision (log silent AND CPU flat, hard cap) and CPU-per-wall starvation test |
| `tools/testing/server_smoke/verdict.cjs` | pure PASS/STALL/HOST STARVED/FAIL decision (worldgen-stall classification) and crash-report parsing (mod name and failure message) |
| `tools/testing/server_smoke/log_report.cjs`, `known_noise.json` | pure log grouping: errors and exceptions by signature, known boot noise vs new; the `DONE_RE` and `SPAWN_RE` regexes |
| `tools/analysis/dedup/guard.cjs` | duplicate-group allowance comparison (unexplained, changed, stale) shared by the cached-jar test and the pack test's live check |
| `tools/testing/pack_test/run.cjs`, `analyze.cjs` | CLI and orchestration (verify, stage, scan, select target through `session/target`, analyse); offline analysis of a run folder: load evidence, run every check, write report/summary/candidate baseline |
| `tools/testing/pack_test/recipe_json.cjs` | pure readers over recipe JSON (`ingredientRefs`, `declaredOutputRefs`, `declaredOutputs`, `isResourceId`); used by `session/resources` and the checks (including `snapshot`), so `session/` never depends on `checks/` |
| `tools/testing/pack_test/stage_runtime.cjs` | neutral staged-server runtime policy: `WORLD`, `STAGE_RUNTIME` and `isStageRuntime(rel)` shared by local preparation, world caching and ANU sync; `stageDirFor(artifacts, runtime)`, the one local stage path per runtime |
| `tools/testing/pack_test/session/` | before and during the boot: `prepare` (runtime-stamped staged server rebuilt when its stamp differs, per-run copy with hard-linked jars, probe injection), `run_meta` (artifact-root guard, run id, what was tested), `world_cache` (world key over runtime, seed, profile, jar bytes and world-shaping config; stamped save; restore refused across runtimes), `execute` (one boot until the probe manifest, evidence collection), `security` (pre-boot malware evidence), `resources` (raw data scan of the installed jars and KubeJS data, shipped-config scan and pre-boot scan/policy writer), `extract` (pure loot/worldgen references and lenient JSON), `target` (local/ANU choice, fallback and one starved shared-run retry), `lock` (local pid file lock), `aborts` (interrupt-callback registry with disposers) |
| `tools/testing/pack_test/probe/` | KubeJS server scripts injected into the test server only: `registries` (registries, final tags, mods, loot tables), `recipes` (every live recipe normalized), `crafting` (FakePlayer crafts in a real crafting menu), `runtime` (live evidence for script-runtime assumptions and chosen items' data components), `startup_globals` (startup script: the `global.packTest` namespace and a NativeEvents check), `bootstrap` (sections, payloads, manifest last) |
| `tools/testing/pack_test/checks/` | pure checks over the evidence: `recipes` (+ `conditions` evaluator), `references` (removed mods must not be loaded; required mods must be present), `acquisition`, `bees` (Productive Bees outputs), `machines`, `crafting`, `dedup`, `logs`, `security/` (malware today; future runtime-egress checks belong here); `snapshot` indexes probe registries/tags and recipe/bee products for the checks; each check builds findings with `verdict/finding` |
| `tools/testing/pack_test/verdict/` | `protocol` (probe contract and validation), `baseline` (finding identity, new/known/resolved), `report` (report.json, summary.txt, exit code), `mode` (run mode label, starved-boot rule), `policy` (tool data, the acquisition exclusion policy, the pack config files copied as evidence), `finding` (`makeFinding(check)` and `sectionResult`, the one finding shape) |
| `tools/testing/pack_test/remote/` | ANU target: `config` (hosts, paths, per-runtime `lane()` stage/worlds/code with one shared lock), `ssh` (encoded PowerShell over SSH, scp), `sync` (manifest-diff tar sync), `provision` (portable Node and one JDK per Java major, README), `capacity` (alone/shared/fallback decision + read-only load probe), `lease/` (`dir_lock`: owner.json contract, stale rule incl. unreadable owners, PowerShell take/release, `{ runId, claimId }` lease values, `ownsLease` and atomic Node heartbeat; `lifecycle`: `startLease`, heartbeat and terminal stop/cleanup), `scripts` (launch, status, command-line-guarded kill PowerShell), `evidence` (pull the run's evidence home), `anu` (the sync, launch, poll, pull orchestrator), `agent` (runs on ANU with the job's runtime descriptor, Java/jcmd and lane run/cache paths; lease loss kills owned children and exits 2) |
| `tools/testing/pack_test/tests/` | `checks/`: pure evidence checks (including `malware.test.cjs`) and recipe/bee product indexing; `data/pack_contract.test.cjs`: real pack metafiles, policy and the day-length config pins; `remote/`: `dir_lock.test.cjs`, capacity, sync, lease lifecycle and guarded process cleanup; `verdict/`: protocol, baseline, finding and report; `session/`: locks, `jar_walk.test.cjs`, resource extraction, boot lifecycle and target sequencing. Run all five with `node --test tools/testing/pack_test/tests/*/*.cjs`. |
| `tools/analysis/dedup/catalog.cjs`, `generate.cjs`, `overrides.cjs`, `hidden_reasons.json` | `catalog`: scan of the pinned jars (duplicate groups); `generate`: writes `kubejs/data/<mod>/` overrides and the EMI removals from `dedup.json` after a jar change, never downloads; `overrides`: computes `dedup.json` block-tag removals and data-only patches for custom serializers (counts, chances, conditions kept); `hidden_reasons.json`: one recorded reason per `hiddenOnly` id (guarded by its test) |
| `tools/analysis/emi_coverage/scan_jars.cjs` | read-only scan of mod jars for viewer plugin coverage using data_io's ZIP reader |
| `tools/data_io/zip_reader.cjs` | dependency-free ZIP entry listing and decompression; shared by coverage and jar traversal |
| `tools/data_io/walk.cjs` | ordered jar traversal, optional jarjar recursion, caller-owned selection and parsing |
| `tools/data_io/files.cjs` | strict JSON file reading (`readJson`) and byte SHA-256 (`sha256`) |
| `tools/data_io/resource_layout.cjs` | versioned data-path recognition: 1.20 plural and 1.21 singular folders (`recipe/`, `loot_table/`, `tags/item|block|fluid`, `neoforge/biome_modifier`) to one canonical kind, `dataPath`, and `neoforge:conditions`/`conditions` plus loader-neutral condition types; shared by the pack-test raw scan and dedup |
| `tools/analysis/dedup/policy.cjs` | ordered retired ids for Node consumers; shipped KubeJS mirror pinned by `tests/policy.test.cjs` |
| `tools/analysis/dedup/generated_files.cjs`, `generated.json` | generator ownership: the manifest of every file the generator wrote with its sha256; a regeneration deletes only unmodified owned outputs it no longer produces, so hand-written data and hand-edited outputs survive |
| `tools/analysis/dedup/migration-1.21.json` | the dedup policy changes made for the NeoForge 1.21.1 target (dropped ids, translated `forge:` → `c:` tags, allowed groups, hand-written override dispositions) |
| `tools/packwiz/migration/config-decisions.json` | per-config migration treatment (carry, preserve-intent, regenerate at first target boot) and the removed/replaced files; enforced by `tests/config_decisions.test.cjs` |
| `tools/packwiz/migration/deferred/` | unshipped parking for the seven deferred ports: their configs and data at original paths, port-dependent dedup policy and pack-test baseline entries, and the restore steps (`README.md`) |

[Architecture](docs/ARCHITECTURE.md) maps the automated pack-test flow;
[EMI](docs/emi.md) is the architecture doc for the EMI subsystem.

KubeJS loads client scripts in descending `// priority:` order. Each script adds one
namespace to `global.emiCuration`. Only `session.js` (through `ClientEvents`), `ui/button.js`, `ui/mods/mods_menu.js`, `ui/decor_button.js` and `ui/decor_mark.js` (through `ui/native_hooks.js`) register event
handlers.

## Dependencies

- The curation scripts depend on **EMI internals** (`EmiStackList`, `EmiRecipes.manager`, `EmiSearch`, `EmiScreenManager`, `EmiReloadManager`, `EmiHidden`). Those are confined to `index_view.js` (also its `EmiScreenManager` refresh), `recipe_view.js`, `hiding.js` (`EmiHidden`), `session.js` (`EmiReloadManager`) and `ui/emi_screen.js` (the `EmiScreenManager` search widget and hover lookups; `placement.js`, `mods_menu.js` and `decor_mark.js` go through it). EMI is pinned to 1.1.24+1.21.1+neoforge, so re-verify these before changing its version.
- JEI must stay installed: EMI's JEMI bridge only loads JEI plugins when JEI is present.
- `tools/testing/pack_test/session/resources.cjs` depends on `verdict/policy.cjs` for the pack config files copied as evidence.
- Node sleeps use `node:timers/promises`; process priority/CPU queries require an explicit owning scope.
- Tooling needs Node 22 and git (`rehash.cjs` lists files with `git ls-files`). There is no packwiz CLI, Python or build step.
- The installer is `packwiz-installer-bootstrap.jar` in `C:/Users/dirty/MultiMC/packwiz/`, outside the repo. See `docs/development.md`.
- The pack test needs `ssh`/`scp`/`tar` on Valhalla for its ANU target, and on ANU only what `remote/provision.cjs` installs under `C:\Tools\evil-eye-pack`.

## Structural debt

Baseline review 2026-10-12. Remaining debt is filed in Docket (`docs/items/`, `dk list`):

- The EMI views rely on public-but-internal EMI fields. A custom mod would avoid that but would need building and hosting. Rejected for now; see `docs/DECISIONS.md`.

Last full review: 2026-10-12
