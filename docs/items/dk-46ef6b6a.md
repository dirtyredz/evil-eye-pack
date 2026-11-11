---
id: dk-46ef6b6a
type: task
created: 2026-11-11
status: todo
since: 2026-11-11
area: structure
priority: P3
rank: zzzzzzzzzzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Rename server_stage installPack to installServerPack

Push sign-off 2026-11-11 (P2): tools/server_stage/pack_install.cjs exports installPack (packwiz-installer -s server), the same name as the client install route in tools/packwiz/install/install_pack.cjs. Two different exported functions with one name in neighbouring shared homes invite a wrong import. Rename the server one (e.g. installServerPack) and update callers when the file is next touched. Acceptance: no two exported installPack functions; fast gate passes.
