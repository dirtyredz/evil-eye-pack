---
id: dk-d4cea2d5
type: task
created: 2026-11-02
status: done
since: 2026-11-02
area: consolidation
priority: P2
rank: zzzzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Replace Pro Placer with Evil Eye Client 0.7.0

Replaced Pro Placer with client-only Evil Eye Client 0.7.0. Updated exact private pin, generated lock, dispositions/config records, removedMods, mod map, defaults, count (158 to 157) and docs. Puzzles Lib/Diagonal Fences and other remaining candidates are retained; Chloride was already absent in supplied main.

Verified: 583 Node tests; hash chain; migration checks in both caches; recursive closure of 157 roots/234 archives/83843 classes with no Pro Placer consumers/resources; existing converted-world inventory has no Pro Placer references. Client mixin audit passed 240 configs/1798 targets with existing reviewed exceptions. One offline full-pack server boot passed: 25.401 seconds server startup, 75.451 seconds wall to Done, normal shutdown, no new error groups.

Evidence: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-11-02-pro-placer. Full handoff: C:/Users/dirty/projects/artifacts/minecraft-mods/jobs/2026-11-02-pro-placer/handoff.md. Owner input/multiplayer acceptance remains manual; nothing pushed, merged or installed into an instance.
