---
id: dk-e9c3d82d
type: bug
created: 2026-10-23
status: todo
since: 2026-10-23
area:
priority: P2
rank: zzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# KubeJS ConcurrentModificationException at mod construction (about 1 boot in 10)


KubeJS 2001.6.5-build.26 (the latest 1.20.1 Forge build, published 2026-05-01) intermittently fails to construct: `ConcurrentModificationException` at `ScriptManager.load(ScriptManager.java:192)`, from `KubeJS.<init>` on a `modloading-worker` thread. Seen on 2026-10-23 (crash report in `artifacts/evil-eye-pack/jobs/2026-10-23-pack-tester/runs/run-2026-10-23T19-01-45-440Z/evidence/crash-reports/`).

Root cause (bytecode, `javap` of the shipped jar): line 192 is the loop that walks `Registry.registryKeySet()` of the root registry (an unmodifiable view over a `HashMap` key set) to register type wrappers per registry. Forge constructs mods in parallel, so any other mod that adds a registry to that root set during its own constructor at the same moment breaks the iterator. In the crash log, Moonlight Lib (config load at 26.68 s) and Puzzles Lib (`diagonalfences:main` at 26.96 s) were constructing within 0.4 s of the crash; the exact writer was not isolated.

No version fix exists (build.26 is current; the changelogs mention no fix). No KubeJS config setting avoids it. Option: `config/fml.toml` `maxThreads = 1` serialises mod construction and removes the race, at the cost of slower launches for every player (not measured). Otherwise live with it: a player relaunches; the pack test reports it as an invalid run (exit 2) and is rerun.

Acceptance: identify the registering mod (instrument or bisect), then either report it upstream, pin around it, or accept `maxThreads = 1` after measuring the launch-time cost.
