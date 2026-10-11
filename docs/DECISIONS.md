# Decisions

Newest first.

## 2026-10-11 — EMI trial: EMI + JEI + JEP on a separate branch and instance

**Decision.** Trial EMI 1.1.24+1.20.1+forge on `emi-trial`, in a copied MultiMC instance,
alongside JEI 15.20.0.102 and Just Enough Professions 3.0.1. REI, REI Plugin
Compatibilities and Roughly Enough Professions are removed on that branch only. `main`
stays on REI until the owner decides.

**Why.**
- EMI only runs JEI plugins through its JEMI bridge when JEI itself is installed. Most of this pack's integrations are JEI plugins (see `emi-coverage.md`).
- JEI `15.20.0.102` is the JEI API version EMI 1.1.24 builds against, so it is the compatibility baseline. Change it only for a demonstrated dependency or API need, and record why.
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
