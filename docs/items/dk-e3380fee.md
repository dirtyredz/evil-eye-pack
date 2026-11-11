---
id: dk-e3380fee
type: task
created: 2026-11-01
status: done
since: 2026-11-11
area: structure
priority: P2
rank: zzzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Push sign-off P2s: canonical paths in instance_targets, stale runtime docs, runtime_env test home


Round-2 push sign-off 2026-11-01 (PASS) raised four P2s:
1. tools/packwiz/install/instance_targets.cjs compares path strings without resolving the real path: 8.3 short names or \localhost\C$ / \?\ aliases count as "outside the instances folder", and rollback.ps1 never runs noLinks, so a junction outside the folder pointing at another instance passes. Canonicalize in the authority (fs.realpathSync.native on the deepest existing ancestor) so classify, stableTarget and both PowerShell scripts inherit it.
2. docs/development.md:407 still says Forge 47.4.10 on main; main is NeoForge 21.1.265 / MC 1.21.1. Say the runtime comes from pack.toml.
3. tools/runtime_env/env.cjs header still frames it as the server-smoke env; reword as the shared machine environment with FIXED for the install route.
4. procs.test.cjs lives in tools/testing/server_smoke/tests but covers tools/runtime_env/procs.cjs; move to tools/runtime_env/tests/, add to the test glob, give procs.cjs its own STRUCTURE row.
Do 1 before any non-default -Instance use of cutover/rollback.
