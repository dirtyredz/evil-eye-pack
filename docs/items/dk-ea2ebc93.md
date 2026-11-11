---
id: dk-ea2ebc93
type: task
created: 2026-11-02
status: done
since: 2026-11-11
area: packwiz
priority: P2
rank: zzzzzzzzzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Report would-be-restored files in the Stable prelaunch dry run


Sign-off 2026-11-02. `install_pack.cjs:114` returns before the restore step in dry-run mode, so the owner's rehearsal never shows which files would be restored.

Direction: in dry run, list installed files whose bytes differ without writing.
