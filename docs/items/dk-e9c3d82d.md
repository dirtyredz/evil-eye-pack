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

**Update 2026-10-24: writer identified, fix chosen.** The stage-1 and stage-3 diagnoses are in `artifacts/evil-eye-pack/jobs/2026-10-24-kubejs-cme/` (`static-findings.md`, `stage3-spec.md`).
- **Writer:** CorgiLib 4.0.3.5. `CorgiLibRegistry.<clinit>` adds 3 root registries on its constructor path, proven by bytecode but not caught at runtime. Moonlight Lib and Puzzles Lib are cleared. Create writes earlier, during bootstrap.
- **Ruled out:** Forge dependency ordering (constructors run with `runAsync` and don't wait for dependencies), a KubeJS config setting, startup scripts, and a key-set copy.
- **`maxThreads = 1` cost:** +4.56 s mean per server launch (59.2 s → 63.8 s, n=3 each). Not measured on clients.
- **Chosen fix (owner, 2026-10-24):** the custom compat mod `CorgiKubeJSCompat`, built in minecraft-mods as `dk-f5d5af17`. A KubeJS plugin forces CorgiLib's registry class init before KubeJS iterates the root.
- **Blocked on minecraft-mods `dk-f5d5af17`.** When it ships, add `mods/corgi-kubejs-compat.pw.toml` (side both), rehash, and run the pack test.
- **Fallback:** `config/fml.toml maxThreads = 1`.
