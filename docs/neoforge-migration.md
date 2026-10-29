# NeoForge 1.21.1 migration

Moves Evil Eye from Forge 47.4.10 / Minecraft 1.20.1 / Java 17 to NeoForge 21.1.265 /
Minecraft 1.21.1 / Java 21 on the long-lived branch `migration/neoforge-1.21.1`. `main` and
the Stable instance stay on Forge until the owner declares the candidate 100% (Phase 10).
Plan: `artifacts/evil-eye-pack/jobs/2026-10-29-neoforge-migration-plan/plan.md`; Docket parent
`dk-876bc6ca`.

## Isolation

| What | Where |
|---|---|
| Branch / worktree | `migration/neoforge-1.21.1` at `C:/Users/dirty/projects/.worktrees/evil-eye-pack/migration/neoforge-1.21.1` |
| Trial instance | `C:/Users/dirty/MultiMC/instances/Evil Eye NeoForge Trial/` — fresh (no saves, mods, logs or `options.txt`), components `net.minecraft` 1.21.1 + `net.neoforged` 21.1.265 set in `mmc-pack.json` (the packwiz installer never sets the loader) |
| Trial Java | `C:/Tools/evil-eye-pack/temurin-21/bin/java.exe` (Temurin 21.0.13+9, zip SHA-256 `a4dbaa05…04f9` checked against the Adoptium API). Explicit per-instance path; global Java, PATH and JAVA_HOME untouched |
| Trial prelaunch | the shared packwiz bootstrap with this worktree's `pack.toml` path |
| Migration jobs | `artifacts/evil-eye-pack/jobs/2026-10-29-neoforge-*/` |
| Reusable migration caches | `artifacts/evil-eye-pack/migration/` (verified target jars), `artifacts/evil-eye-pack/runtime/` (JDK downloads) |

Do not launch the trial instance before Phase 5: until then the worktree's `pack.toml` still
pins Forge 1.20.1 content and the install would put 1.20.1 jars into a NeoForge instance.

Pushing the migration branch is safe for Stable: Stable's prelaunch reads `main`'s raw
`pack.toml` URL. Push only the migration ref; never `main`.

### Starting evidence (recorded 2026-10-29)

`jobs/2026-10-29-neoforge-isolation/stable-evidence.json` (recorder and `--check` mode:
`evidence.mjs` beside it). Main, `origin/main` and the published ref were all `ebcd9e8`;
Stable: Minecraft 1.20.1, Forge 47.4.10, Java 17.0.10, prelaunch on the GitHub `main` URL,
182 installed jars hashed, one save (`New World`). Evil Eye Local unchanged. Re-run
`node evidence.mjs --check stable-evidence.json` before any later phase gate.

## Phase status

| Phase | Item | Status |
|---|---|---|
| 1 Isolate worktree, instance and evidence | dk-00608fcb | done |
| 2 Resolve and lock target artifacts | dk-1254cf3d | in progress |
| 3 Runtime-aware testing | dk-b28c4c95 | todo |
| 4 Data scanners and metadata | — | todo |
| 5 Activate pins, swaps, configs | — | todo |
| 6 First clean target boot | — | todo |
| 7 Interstellaris stack | — | todo |
| 8 Seven owned ports | — | todo |
| 9 World conversion on a copy | — | todo |
| 10 Qualify 100% and cutover | — | todo |

## Owned ports (deferred, never abandoned)

Seven mods have no NeoForge 1.21.1 build and are being ported by the owner in
`minecraft-mods`: Dank Recipe Transfer, Roundwood, Ars Instrumentum, Alex's Mobs, Alex's Caves,
Ice and Fire, and FlatWorldFix (kept and ported rather than swapped for Give Me My Flat World).
The lock records each as `defer`; Phase 5 suspends their references until the ports return.

## 100% checklist

See plan Phase 10. Every criterion there is required; temporary absences, a successful boot
alone or a world saved without its content never satisfy it.
