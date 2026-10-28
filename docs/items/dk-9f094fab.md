---
id: dk-9f094fab
type: task
created: 2026-10-28
status: todo
since: 2026-10-28
area: mod-map
priority: P3
rank: zzzzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Unify or document mod map nested-jar walk vs data_io walkJar

tools/mod_map/inventory/inventory.cjs (inspectJar) walks declared META-INF/jarjar/metadata.json archives itself, while tools/data_io/walk.cjs (walkJar) is the shared ordered jar traversal with optional jarjar recursion. Either move mod_map onto walkJar or document why it needs its own walk (it reports bundled provenance per nested archive and fails on a missing declared jar). Raised by the 2026-10-28 mod-map push structure review.
