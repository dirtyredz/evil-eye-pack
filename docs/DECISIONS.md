# Decisions

Newest first.

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
