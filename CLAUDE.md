# Evil Eye pack — working here

- Read `docs/development.md` before touching instances, worktrees, feeds or job artifacts, and `docs/GOTCHAS.md` before editing pack files. `STRUCTURE.md` maps the repo.
- Every pack-file edit: save as UTF-8 LF, then `node tools/packwiz/rehash.cjs` and `node tools/packwiz/verify_hashes.cjs`. Never copy `index.toml`/`pack.toml` between branches; rehash each branch on its own.
- Nothing reaches the Stable instance until `main` is pushed. Test unpushed changes only in **Evil Eye Local** or a trial instance (they install from the checkout on launch: rehash, then Launch), never in Stable.
- Dispatch artifacts go in `C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/<YYYY-MM-DD-task>/`: `--prompt-file`, `--output-file` and shell redirections included. Never write job files into `projects/` or the repo.
- Experiments live in linked worktrees under `C:/Users/dirty/projects/worktrees/evil-eye-pack/`. Move them only with `git worktree move`.
- Stop any `serve.cjs` you start (MultiMC no longer needs one).
