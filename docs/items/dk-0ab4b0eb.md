---
id: dk-0ab4b0eb
type: task
created: 2026-11-07
status: todo
since: 2026-11-07
area:
priority: P3
rank: zzzzzzzzzzzn
parent:
fixes: []
blocked_by: []
relates: []
---
# Move MAIN_CHECKOUT out of instance_targets.cjs into local_target.cjs or runtime_env


tools/packwiz/install/instance_targets.cjs still exports MAIN_CHECKOUT, which only Local uses. Move it to local_target.cjs or tools/runtime_env/env.cjs.
