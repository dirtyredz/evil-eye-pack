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
# World conversion still drops colony flag state


Observed in the guarded Phase 9 trial of the owner Stable world on 2026-10-30. Evidence root: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-30-world-trial/.

Confirmed conversion losses: Curios equipment; portable Dank frequency components (four backing stores remain); five named Ars Nouveau starbuncles (all 80 baseline starbuncle UUIDs absent); Ender IO primitive alloy smelter and its 20 coal; four loaded Supplementaries signposts. Two unloaded signposts still reference the absent target registry. Both target boots finish probes/save but require forced termination after the graceful deadline.

See world-trial-report.md, minecraft-mods-handoff.md and losses/ for UUIDs, coordinates, payloads, load exceptions and shutdown threads. No jars were patched. Original and snapshot remain protected.

Acceptance: provide schema/registry migrations, rerun from the immutable pre-conversion snapshot, preserve the lost state, establish storage accessibility and colony work, complete a clean shutdown/restart and only then produce an owner walk-through copy.

2026-10-30 authoritative re-run with evileye_migration 0.1.0-dev.1 (8b30349, sha256 dc072b8969960a5e3aac49016a48c9912ee558ee598d3415c8185a78968460a8): ANU fresh-world PASS; fast gate 520/520. Conversion and restart each visit 943 chunks and stop naturally (killed:false, crashed:false). Both domain audits pass 67/68 checks, preserving source starbuncles/names, Curios, live Dank links and 9312 stored items, Ender IO machines/20 coal, visited signs, four citizen inventories/native links and all 26 dragons. Forced chunks tick for 400 ticks and all four citizens bind to colony 1 on both boots. Snapshot has 79 starbuncles; the earlier baseline generated its 80th.

Gate remains LOSS: colonyflag [{Color:0,Pattern:"b"}] decodes with missing color/pattern errors and saves as []; persisted Polymorph recipe selection also resets for one player. Raw full comparisons and multipart helper equivalence remain unqualified, not waived. No validated owner copy. Evidence and minecraft-mods handoff: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-30-world-trial-2/world-trial-report.md and minecraft-mods-handoff.md. Original/snapshot hashes and main/Stable/Local isolation pass. Keep open for a repaired bridge, fresh clean trial and walkthrough.
