# Decisions

Newest first.

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
