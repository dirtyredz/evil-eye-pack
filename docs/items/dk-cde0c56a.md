---
id: dk-cde0c56a
type: task
created: 2026-11-02
status: done
since: 2026-11-11
area: packwiz
priority: P2
rank: zzzzzzzzzzzzn
parent:
fixes: []
blocked_by: []
relates: []
---
# Bound installer drift backups and flag files restored every launch


Sign-off 2026-11-02 (0.8.0 release). `tools/packwiz/install/install_pack.cjs:142` keeps a new `.tmp/trial-install-*/drift-backup` per run, and stable-prelaunch runs on every launch, so a config the game rewrites each session (Modern UI client.toml) adds a backup folder per launch, unbounded. The `drift-backup` literal also lives in both restorePackFiles and the finally cleanup.

Direction: one rolling backup folder (keep last N) behind a single constant; flag any file restored on two consecutive runs so its game-written bytes get shipped instead.
