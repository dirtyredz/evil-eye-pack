# Development workflow

How the pack source, experiment worktrees, job artifacts and MultiMC instances fit together,
and how to test a change in the game before it is pushed.

## Where things live

| Path (under `C:/Users/dirty/`) | Responsibility |
|---|---|
| `projects/evil-eye-pack/` | Main checkout (`main`). Pack files keep their layout. |
| `projects/worktrees/evil-eye-pack/<name>/` | Linked worktrees for experiments (today: `emi-trial/`). |
| `projects/artifacts/evil-eye-pack/jobs/<date-task>/` | Dispatch prompts, plans, reports and their `.events.jsonl` / `.job.json` / `.stderr.log` sidecars. |
| `MultiMC/instances/Evil Eye Stable/` | Display name **Evil Eye (Stable)**. The owner's real worlds. Installs published `main`. |
| `MultiMC/instances/Evil Eye Local/` | Disposable copy of Stable (no saves). Installs the main checkout from localhost. |
| `MultiMC/instances/Evil Eye EMI Trial/` | Disposable trial instance. Installs the `emi-trial` worktree from localhost. |
| `MultiMC/packwiz/packwiz-installer-bootstrap.jar` | Shared installer bootstrap used by every instance. |
| `MultiMC/backups/evil-eye/<instance>/<timestamp>/` | Instance backups (`instance/`, `launcher/`, `SHA256SUMS.txt`). Older `MultiMC/backups/Evil Eye 2026-10-11/` is kept as is. |

Use a **worktree plus its own instance** for every experiment. The worktree isolates source;
the instance isolates installed jars, installer state (`.minecraft/packwiz.json`), configs and
worlds. Switch branches in a checkout only for quick reading, never while its feed is served.

## Instance and feed mapping

Every instance runs the same pre-launch command; only the pack location differs:
`"$INST_JAVA" -jar "C:/Users/dirty/MultiMC/packwiz/packwiz-installer-bootstrap.jar" <PACK>`

Local instances point `<PACK>` at a `pack.toml` file path, not a URL. The installer reads that checkout
directly on every launch (verified headless 2026-10-11: full install, exit 0), so there is no server to start.

| Instance | `<PACK>` | Installs from |
|---|---|---|
| Evil Eye (Stable) | `https://raw.githubusercontent.com/dirtyredz/evil-eye-pack/main/pack.toml` | GitHub (after a push) |
| Evil Eye Local | `C:/Users/dirty/projects/evil-eye-pack/pack.toml` | the main checkout on disk |
| Evil Eye EMI Trial | `C:/Users/dirty/projects/worktrees/evil-eye-pack/emi-trial/pack.toml` | the `emi-trial` worktree on disk |

Each test instance's path belongs to one checkout; never point an instance at another checkout's `pack.toml`.
`tools/packwiz/serve.cjs` is no longer needed for MultiMC (kept as a tool for serving a checkout over HTTP).

## Testing an uncommitted change

1. Edit the pack file. Save it as UTF-8 with LF line endings.
2. `node tools/packwiz/rehash.cjs` (rebuilds `index.toml`, then the index hash in `pack.toml`).
3. `node tools/packwiz/verify_hashes.cjs` must print `OK 0 mismatches`.
4. Click Launch on the matching **test** instance in MultiMC. Do not edit source files while it installs.
   If the installer fails (bad path, hash mismatch), abort; never click past it to play on stale files.

The installer reads exact disk bytes and does not rehash. Steps 2 and 3 come before every launch.

## Checks (fast gate)

```
node --test tools/packwiz/tests/verify_hashes.test.cjs
node tools/packwiz/rehash.cjs --dry-run      # a second run after rehash must show +0 -0 ~0
node tools/packwiz/verify_hashes.cjs
git diff --check
git worktree list --porcelain
```

Tooling needs Node 22. There is no packwiz CLI and no build step.

## Job artifacts (agent dispatches)

Every dispatch gets its own `projects/artifacts/evil-eye-pack/jobs/<YYYY-MM-DD-task>/`.
`--prompt-file`, `--output-file` and any shell redirection go inside it, never in
`projects/` or the repo. The migration record of the files moved there on 2026-10-11 is in
`jobs/2026-10-11-layout-migration/artifact-moves.md`.

## Worktrees

- Create: `git worktree add ../worktrees/evil-eye-pack/<name> -b <branch>` from the main checkout.
- Move: only `git worktree move <old> <new>`. Stop its server first. Never move it in Explorer
  and never `git worktree prune` during recovery.
- Retire: archive results, keep a branch or tag, then `git worktree remove` a clean worktree.

## Backup and restore

- Backup: close MultiMC and Minecraft, then copy the whole instance folder plus
  `MultiMC/multimc.cfg` and `MultiMC/instances/instgroups.json` into
  `MultiMC/backups/evil-eye/<instance>/<timestamp>/`, and compare file counts and SHA256 with the
  original. `jobs/2026-10-11-layout-migration/backup-instances.ps1` does this.
- Restore: close MultiMC, replace the instance folder with the backup's `instance/` and put
  back the two launcher files.
- Undo the 2026-10-11 rename: close MultiMC, rename `Evil Eye Stable` back to `Evil Eye Dev1`,
  restore its `instance.cfg` and `multimc.cfg` from the backup.
- Undo the worktree move: `git worktree move ../worktrees/evil-eye-pack/emi-trial ../evil-eye-pack-emi`.

## Acceptance checklist (manual, owner)

- [ ] Each test instance installs from its own checkout: its pre-launch path matches the table above.
- [ ] A reversible uncommitted change reaches only its test instance, with no commit or push.
- [ ] Testing in Local or the trial leaves `Evil Eye Stable` unchanged.
- [ ] With the checkout's `pack.toml` unreadable or a hash wrong, the test instance's launch fails visibly; abort rather than continue.
- [ ] After the rename, Stable shows one entry, Minecraft 1.20.1, Forge 47.4.10, and its worlds, settings, waypoints and `packwiz.json` are intact.
- [ ] The EMI trial sync installs EMI/JEI/JEP and removes the REI jars and `rei_filter_toggle.js` (see the trial branch's `docs/emi-trial.md`).
- [ ] Restoring an instance backup and the reverse worktree move both recover the recorded baseline.
