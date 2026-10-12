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
- `config/emi-curation/` — EMI curation data: `rules.json` plus five explicit item lists
- `defaultconfigs/` — Forge default (per-world) configs
- `kubejs/client_scripts/emi_curation/` — client scripts for the curated EMI views and the CLEAN/ALL button
- `tools/emi_curation/` — unshipped: REI-to-EMI migration check, its frozen REI fixture, Node tests for the curation scripts
- `tools/emi_coverage/` — unshipped: read-only jar scanner for viewer plugin coverage
- `tools/packwiz/` — unshipped: hash-chain verifier, index rebuild, localhost pack server, tests
- `docs/` — unshipped living docs (development workflow, decisions, gotchas, EMI guide and integration coverage)

## Components

| Component | Responsibility |
|---|---|
| `tools/packwiz/pack_index.cjs` | index/pack TOML parse and format, `.packwizignore`, byte hashing, publishable-file listing |
| `tools/packwiz/rehash.cjs` | rebuild `index.toml` membership and hashes, then `pack.toml`'s index hash |
| `tools/packwiz/verify_hashes.cjs` | check the hash chain, index membership and optionally jar hashes |
| `tools/packwiz/serve.cjs` | serve the containing checkout on `127.0.0.1` over HTTP (not used by MultiMC: local instances install from the file path) |
| `emi_curation/diagnostics.js` (priority 100) | guarded logging; nothing may throw into Forge or EMI |
| `emi_curation/policy.js` (90) | parse and validate the curation JSON. Stack, NBT and REI display-rule predicates. Pure: no Java, no EMI mutation. |
| `emi_curation/java_interop.js` (85) | class lookup, Java reference identity, Java lists and `len`/`at` accessors, `EmiStack` → policy descriptor (NBT walk) |
| `emi_curation/index_view.js` (80) | swap `EmiStackList.filteredStacks` between EMI's list and the CLEAN copy, then refresh search and sidebars |
| `emi_curation/recipe_view.js` (70) | JS `EmiRecipeManager` wrapper over the baseline manager, filtering displays |
| `emi_curation/hiding.js` (65) | the "what is hidden" decision: pack policy per stack (cached per registry key) and REI-style display hiding (adds EMI's user-hidden set and index key set) |
| `emi_curation/session.js` (60) | CLEAN/ALL state in `global`, EMI generation tracking, tick → sync → apply with restore on failure, reload/logout handling, event registration |
| `emi_curation/button.js` (50) | button placement from EMI's search bounds. Forge screen listeners, registered once. |
| `tools/emi_curation/migrate_rei.cjs` | one-shot REI → EMI data migration and its `--check` against the frozen fixture in `tools/emi_curation/fixtures/` |
| `tools/emi_curation/tests/harness.cjs`, `fake_emi.cjs` | Node harness that loads the production scripts into a `vm` context in KubeJS priority order, and a fake EMI/Java world to drive them |
| `tools/emi_coverage/scan_jars.cjs`, `zip_reader.cjs` | read-only scan of mod jars for viewer plugin coverage; `zip_reader` is its dependency-free jar reader |

`docs/emi.md` is the architecture doc for the EMI subsystem (there is no separate `ARCHITECTURE.md`).

KubeJS loads client scripts in descending `// priority:` order. Each script adds one
namespace to `global.emiCuration`. Only `session.js` and `button.js` register event
handlers.

## Dependencies

- The curation scripts depend on **EMI internals** (`EmiStackList`, `EmiRecipes.manager`, `EmiSearch`, `EmiScreenManager`, `EmiReloadManager`, `EmiHidden`). Those are confined to `index_view.js`, `recipe_view.js`, `hiding.js` (`EmiHidden`), `session.js` (`EmiReloadManager`) and `button.js`. EMI is pinned to 1.1.24+1.20.1+forge, so re-verify these before changing its version.
- JEI must stay installed: EMI's JEMI bridge only loads JEI plugins when JEI is present.
- Tooling needs Node 22 and git (`rehash.cjs` lists files with `git ls-files`). There is no packwiz CLI, Python or build step.
- The installer is `packwiz-installer-bootstrap.jar` in `C:/Users/dirty/MultiMC/packwiz/`, outside the repo. See `docs/development.md`.

## Structural debt

- The EMI views rely on public-but-internal EMI fields. A custom mod would avoid that but would need building and hosting. Rejected for now; see `docs/DECISIONS.md`.
- No baseline structure review has been run (the repo opts out with `.structure-review-optout`).

Last full review: never
