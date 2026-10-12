# Structure

A packwiz modpack (Minecraft 1.20.1, Forge 47.4.10). The repository holds packwiz
metadata, configs and client scripts that packwiz installs into an instance. It also holds
unshipped tooling and docs, which `.packwizignore` keeps out of the index.

## Layout

- `pack.toml` — pack definition; its `[index]` hash is sha256 of `index.toml`
- `index.toml` — every installed file with its sha256 (rebuild with `tools/packwiz/rehash.cjs`)
- `mods/` — packwiz metafiles (`*.pw.toml`), one per mod jar (CurseForge or Modrinth)
- `shaderpacks/` — shaderpack metafiles and saved shader options
- `config/` — mod configs installed as plain files
- `defaultconfigs/` — Forge default (per-world) configs
- `kubejs/client_scripts/` — client scripts (the REI CLEAN/ALL button)
- `tools/packwiz/` — unshipped: hash-chain verifier, index rebuild, localhost pack server, tests
- `docs/` — unshipped living docs (development workflow, decisions, gotchas)

## Components

| Component | Responsibility |
|---|---|
| `tools/packwiz/pack_index.cjs` | index/pack TOML parse and format, `.packwizignore`, byte hashing, publishable-file listing |
| `tools/packwiz/rehash.cjs` | rebuild `index.toml` membership and hashes, then `pack.toml`'s index hash |
| `tools/packwiz/verify_hashes.cjs` | check the hash chain, index membership and optionally jar hashes |
| `tools/packwiz/serve.cjs` | serve the containing checkout on `127.0.0.1` over HTTP (not used by MultiMC: local instances install from the file path) |
| `kubejs/client_scripts/rei_filter_toggle.js` | REI CLEAN/ALL button: toggles REI's hidden-item filtering in memory |

## Dependencies

- Tooling needs Node 22 and git (`rehash.cjs` lists files with `git ls-files`).
- The installer is `packwiz-installer-bootstrap.jar` in `C:/Users/dirty/MultiMC/packwiz/`, outside the repo. See `docs/development.md`.

## Structural debt

- No baseline structure review has been run (the repo opts out with `.structure-review-optout`).

Last full review: never
