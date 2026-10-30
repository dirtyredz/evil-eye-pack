---
id: dk-d35aac75
type: bug
created: 2026-10-30
status: todo
since: 2026-10-30
area: migration
priority: P1
rank: zzy
parent: dk-876bc6ca
fixes: []
blocked_by: []
relates: [dk-064ce2a5]
---
# Stable conversion discards mod state and fails clean shutdown


Observed in the guarded Phase 9 trial of the owner Stable world on 2026-10-30. Evidence root: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-30-world-trial/.

Confirmed conversion losses: Curios equipment; portable Dank frequency components (four backing stores remain); five named Ars Nouveau starbuncles (all 80 baseline starbuncle UUIDs absent); Ender IO primitive alloy smelter and its 20 coal; four loaded Supplementaries signposts. Two unloaded signposts still reference the absent target registry. Both target boots finish probes/save but require forced termination after the graceful deadline.

See world-trial-report.md, minecraft-mods-handoff.md and losses/ for UUIDs, coordinates, payloads, load exceptions and shutdown threads. No jars were patched. Original and snapshot remain protected.

Acceptance: provide schema/registry migrations, rerun from the immutable pre-conversion snapshot, preserve the lost state, establish storage accessibility and colony work, complete a clean shutdown/restart and only then produce an owner walk-through copy.
