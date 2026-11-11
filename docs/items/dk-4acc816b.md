---
id: dk-4acc816b
type: bug
created: 2026-11-11
status: done
since: 2026-11-11
area:
priority: P2
rank: zzzzzzzzzzzzzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Modern UI and Terralith configs are restored on every Stable launch


Found 2026-11-11 while doing dk-382e202b. The Stable prelaunch dry-run reports "Would restore pack-owned file" for config/modernui/client.toml and config/terralith.json on every launch. Cause: both ship as strictly pack-owned small files, but the mod rewrites each on launch (Modern UI expands client.toml into its ~217-line commented config), so the hash never matches; sync restores it, the game rewrites it again. Harmless today (zoom = true survives the rewrite), but it is a restore every launch and it hides real drift in the dry-run report.

Direction: change those two files' install policy from strictly pack-owned to preserved, and move the settings the pack actually cares about (Modern UI general.zoom; whatever terralith.json sets) into pack-owned keys (tools/packwiz/install/pack-owned-keys.json). Acceptance: two consecutive Stable dry-runs after a launch report no restore for these files; the owned settings still hold.
