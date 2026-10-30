---
id: dk-d35aac75
type: bug
created: 2026-10-30
status: done
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

2026-10-31 brief, final dev.4 verification (machine run date 2026-10-30): PASS. Private evileye_migration 0.1.0-dev.4 from minecraft-mods bd5f1ce, SHA-256 bc150d3a9af7a102de2a39614f7f2a4458465c6f65f4f22a9b20b97e88f4a262. One fresh snapshot-based conversion and one restart each pass 68/68 domain checks, visit 943/943 chunks, and stop naturally (killed:false, crashed:false). Exact flag preservation is established: [{Color:0,Pattern:"b"}] becomes [{color:"white",pattern:"minecraft:base"}] on both saves. All four citizens bind live to colony 1 on both boots; the previous repaired inventory/storage/entity domains remain passing.

The owner/orchestrator explicitly accepts Polymorph SelectedRecipe reset as transient, not LOSS. Domain audits govern this Phase 9 gate; overlapping raw comparison fields/encodings and remaining multipart/opaque behavior become owner walkthrough checks, not blockers. Removal requires every chunk, player including offline, colony and Dank store loaded/saved and pending smelter_items / refunds drained; dev.5 convert-all/status is planned for cutover.

Original/snapshot hashes and main/Stable/Local isolation pass. Evidence: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-world-trial-final/world-trial-report.md. The independent validated restart copy is in Evil Eye NeoForge Trial/.minecraft/saves/Evil Eye Converted (trial), 463 files / 385489451 bytes, copied hashes verified. The script/checklist are prepared; full owner-install verification is tracked by Phase 9, not this resolved state-loss blocker.
