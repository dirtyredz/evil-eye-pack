---
id: dk-c0ca4bea
type: task
created: 2026-11-02
status: done
since: 2026-11-11
area: tools
priority: P2
rank: zzzzzzzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Make artifactJob the single owner of the artifact-jobs root


Structure sign-off 2026-11-02. `tools/data_io/path_guard.cjs:5` hardcodes `ARTIFACT_JOBS` while `tools/runtime_env/env.cjs:23` owns the artifacts root, and `tools/testing/world_trial/run.cjs:14` and `tools/testing/client_mixin/run.cjs:21` still do their own jobs-root checks: three definitions, not one.

Direction: derive `ARTIFACT_JOBS` from env (`FIXED.ARTIFACTS + '/jobs'`) and switch world_trial and client_mixin runners to `guards.artifactJob`.
