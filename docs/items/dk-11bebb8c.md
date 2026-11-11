---
id: dk-11bebb8c
type: task
created: 2026-11-11
status: todo
since: 2026-11-11
area:
priority: P2
rank: zzzzzzzzzzzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Move MultiMC and main-checkout paths into env.cjs; fix STRUCTURE.md path-owner rows


Push sign-off 2026-11-11 (PASS) P2s after env.cjs became the machine-path authority:

- tools/runtime_env/env.cjs:2 says it is the only file naming machine paths, but the MultiMC root and main-checkout path are still hardcoded in tools/data_io/path_guard.cjs:7 (PROTECTED), tools/packwiz/install/instance_targets.cjs:11,15, tools/testing/client_mixin/run.cjs:25,37 and tools/resourcepack/fusion_glass/generate.cjs:22. Add MULTIMC_ROOT / INSTANCES / MAIN_CHECKOUT to env.cjs (FIXED for guards) and import them, or narrow the header.
- STRUCTURE.md:204 says path_guard artifactJob owns the artifact-jobs root (env.cjs owns it now; artifactJob owns containment); the env.cjs row at :288 lacks ARTIFACT_JOBS, javaHome and the paths.cjs/paths.ps1 bridge (line 144 is current).

Acceptance: no MultiMC/checkout literals outside env.cjs, tests and docs; STRUCTURE.md consistent; fast gate green.
