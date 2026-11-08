---
id: dk-aa133ad2
type: task
created: 2026-11-08
status: todo
since: 2026-11-08
area:
priority: P3
rank: zzzzzzzzzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# 2026-11-08 push sign-off P2s: neutral home for server_smoke runtime, explicit private-cache param, ANU paths passed to server-ctl

Sign-off (PASS) on 696ad09: (1) tools/world_server/stage-world-server.cjs:21 imports testing/server_smoke/runtime/runtime.cjs directly besides the documented server_stage -> server_smoke/runtime/setup.cjs edge; move server_smoke/runtime/{runtime,setup}.cjs to a neutral home (tools/server_stage or tools/runtime_env), correct STRUCTURE.md:159 meanwhile (relates dk-0c5b507c). (2) stage-world-server.cjs:17 passes the private-cache location via process.env.SMOKE_MIGRATION_MODS before require; give env.cjs/ensureStage an explicit parameter. (3) scripts/server/server-ctl.ps1 hard-codes G:\evil-eye-pack-ci\server and server-backups separately from anu-world-server.ps1; router should pass -Root/-Backups (fold with dk-8c83c80c).
