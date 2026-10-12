# Gotchas

## Packwiz hashes (no packwiz CLI here)

- Hashes cover **LF bytes**. Git stores and GitHub serves LF (`core.autocrlf=input`, plus `.gitattributes`). A file saved with CRLF or a BOM hashes differently from what the installer downloads.
- A clean `git status` does **not** mean the working tree is LF. On 2026-10-11 the main checkout had 372 CRLF config files that git still reported clean (it compares after conversion). the installer would have read those CRLF bytes and failed the hashes. Check with `git ls-files --eol | grep w/crlf`; fix by deleting those files and `git checkout -- <paths>` (the index copies are LF).
- `tools/packwiz/rehash.cjs` refuses CRLF/BOM files rather than normalizing them, and `verify_hashes.cjs` reports them.
- Order matters. Save the file, rebuild `index.toml` (its sha256 entries), and only then hash the final `index.toml` into `pack.toml`. `rehash.cjs` does both steps in that order.
- Metafile `[download]` hashes describe the **jar bytes**, a separate layer from the index hash of the `.pw.toml` itself. Check jars with `verify_hashes.cjs --jars <dir>`; that checks matching hashes, not that every expected jar is present.
- `.packwizignore` keeps `tools/`, `docs/`, `STRUCTURE.md` and `CLAUDE.md` out of the index. `README.md` and `.structure-review-optout` were already indexed and stay indexed, so editing `README.md` changes the index (rehash).
- After a push, fetch `https://raw.githubusercontent.com/dirtyredz/evil-eye-pack/<branch>/pack.toml` and check that its index hash matches the local one.

## Installer and instances

- `.minecraft/packwiz.json` is the installer's record of the files it manages. It is how removed mods and configs get deleted on the next sync. Keep it when copying an instance; deleting it leaves stale jars behind.
- The installer overwrites pack-managed configs on every sync. In-game config changes are lost unless they are copied back into the repo.
- Local instances install straight from the checkout's files (no server) and never rehash. Rehash and verify before every local install, and do not edit files while an install is reading them.
- MultiMC's instance ID is the **folder name**; the display name is `name=` in `instance.cfg`. Renaming the display name does not rename the folder. Rename folders only with MultiMC closed, and update `SelectedInstance` in `multimc.cfg`.

## Worktrees

- Move a linked worktree only with `git worktree move`. An Explorer move breaks the `.git` file link and the main repo's `worktrees/` record; `git worktree prune` would then delete the record.
- Local instance pre-launch commands hold the worktree's path: after `git worktree move`, update the `PreLaunchCommand` in that instance's `instance.cfg` (MultiMC closed).

## KubeJS 2001.6.5 / Rhino

- `ForgeEvents` is startup-only. Client scripts register with `MinecraftForge.EVENT_BUS.addListener(...)`.
- Forge listeners survive `/kubejs reload`. Register them once behind a `global` flag. An uncaught exception in a Forge listener hard-crashes the client with **no crash report**, so wrap every listener in try/catch.
- KubeJS's script class filter denies `java.io`, `java.nio`, most of `java.lang`, `java.net` and `net.minecraftforge.fml`. A denied `Java.loadClass` fails only at runtime.
