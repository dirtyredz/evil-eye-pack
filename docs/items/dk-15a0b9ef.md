---
id: dk-15a0b9ef
type: bug
created: 2026-11-05
status: todo
since: 2026-11-05
area:
priority: P1
rank: zzzzw
parent:
fixes: []
blocked_by: []
relates: []
---
# Mod adds don't stock the Stable jar cache, so Stable prelaunch fails

2026-11-05: Sophisticated Backpacks was pushed to main, but its three jars were never copied into jobs/2026-10-31-world-trial-final/cache/mods. Stable prelaunch refused with 'Missing pinned jar (no download attempted)' and the game didn't launch. Fixed by hand: copied the jars from jobs/2026-11-04-sophisticated-backpacks/jars, verify_hashes --jars OK, stable-prelaunch -DryRun OK. Wanted: a cheap pre-push check that every pinned jar on main is present in the Stable cache (or the mod-add flow stocks it automatically), so this can't recur.
