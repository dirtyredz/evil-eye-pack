---
id: dk-0ab68ed1
type: task
created: 2026-11-10
status: done
since: 2026-11-10
area:
priority: P1
rank: zzzzzt
parent: dk-8c83c80c
fixes: []
blocked_by: []
relates: []
---
# Extract server lifecycle and consolidate native SSH capture

Extract the world-server process discovery, PID/creation identity, guarded Start, safe Stop and Status into a shipped callable module. Preserve CLI behavior and test via mocked OS operations, without AST extraction. Move native capture to owner-run, route SSH queries through transport, and refresh living docs. Verify the specified world_server/packwiz fast gate only; do not change the live ANU server.
