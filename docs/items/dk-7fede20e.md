---
id: dk-7fede20e
type: bug
created: 2026-10-30
status: done
since: 2026-10-31
area: migration
priority: P1
rank: zzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Trial client freezes on inventory open and remains laggy

Owner reports that the NeoForge Trial client reached 0–1 FPS after EMI became ready; the world never finished loading and the GPU stayed idle. Evidence is in `C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-walk-jfr/` and the earlier diagnosis/fix specification is in `C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-trial-lag/report.md`.

The owner walk joined at 00:22:33 and EMI finished around 00:22:58. From 00:23:00 until quit, 2,054/2,116 main-thread JFR samples were inside KubeJS's client-tick callback. The first index construction did finish: `ArrayList` loaded at 00:22:59 and `Collections`, `EmiScreenManager` and `EmiSearch` loaded by 00:23:01. After that, 179 samples from 00:23:01–00:23:34 were in Rhino `shallowEq -> warnAboutNonJSObject -> ResourceBundle`. KubeJS 2101 performs that expensive warning-message lookup when Java references are compared with JavaScript equality even though no warning is logged. The tick readiness check and `sameRef` helper did this every unchanged tick; similar equality existed in the classification/display-filter hot paths.

The fix removes JavaScript equality from raw-Java reference checks, retains Java identity through `IdentityHashMap`, and uses truthiness for readiness/null checks. Uncached index views now snapshot once and classify in private slices capped at 256 stacks or 4 ms per client tick. Only a complete immutable view is installed and search/sidebars are refreshed once. EMI list replacement, worker activity, script reload, decor-mark changes and logout discard pending work. Deterministic coverage records a 700-stack build as 256/256/188 classifications, one publication, then 3,600 unchanged ticks with zero classification and zero apply/refresh work.

The adjacent 1.21 defect is also fixed: classification-cache hits now read the particular stack through the same `getComponentChanges()` codec adapter as misses, never obsolete `getNbt()`. Repeated component-only variants sharing one item key are covered.

CLEAN recipe-display filtering remains enabled and `config/emi-curation/rules.json` is unchanged, per the owner's open policy decision. Sable/physics policy is unchanged and no Sable work is part of this fix.

Acceptance is the focused EMI curation suite, recursive client-script syntax check, packwiz rehash/hash verification, diff/Docket guards, and an owner walk in the Trial. Expected visible behavior: `EMI: ...` briefly while the first index is prepared, then `EMI: CLEAN`; the world should remain responsive, unchanged ticks should not pin the client main thread, and repeated component variants should not produce curation errors. A real client walk/JFR is still required to confirm frame-time behavior; no visible client is launched by the implementation gate.
