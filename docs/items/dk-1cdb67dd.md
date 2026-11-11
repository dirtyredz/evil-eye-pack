---
id: dk-1cdb67dd
type: task
created: 2026-11-11
status: done
since: 2026-11-11
area:
priority: P2
rank: zzzzzzzzzzzzzzzzn
parent:
fixes: []
blocked_by: []
relates: []
---
# Group install guards under install/checks; drop dead imports in local_target


Push sign-off 2026-11-11 (PASS) P2s on tools/packwiz/install/:

- tools/packwiz/install/ holds 10 loose .cjs + pack-owned-keys.json + targets/ = 12 entries, past the ~10-per-level breadth guideline (code-file cap not exceeded). Move the two guards (stable_cache_check.cjs, stable_prelaunch_check.cjs) into install/checks/ and mirror in tests/install/, keeping the documented `node tools/packwiz/install/stable_prelaunch_check.cjs` entry point working (shim or doc update everywhere it is cited).
- tools/packwiz/install/targets/local_target.cjs:12 imports noLinks from path_guard.cjs but never uses it; drop it.
- tools/packwiz/install/targets/local_target.cjs:56 re-requires install_pack.cjs inside main() for prepareFiles although line 9 imports the module; destructure at line 9 (closes dk-fe8e683c too).

Acceptance: install/ at ≤10 entries; Stable prelaunch check and dry-run OK; fast-gate tests pass.
