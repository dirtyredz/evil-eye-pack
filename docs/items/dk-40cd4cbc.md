---
id: dk-40cd4cbc
type: task
created: 2026-10-25
status: done
since: 2026-10-25
area:
priority: P2
rank: zzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Add Roundwood 0.13.3 to the pack

Pin the owner-approved Roundwood 0.13.3 release on both sides. Verify SHA-256, scan the isolated jar and gate metadata, check dependencies, update pack documentation and hashes, and run a headless boot with the native Roundwood showcase and contraption storage regression. Compare warnings/errors with main; retain evidence in jobs/2026-10-25-add-roundwood. No client, Stable/Local changes, merge or push.

Completed 2026-10-25:
- Direct GitHub release pin, SHA-256 150874f1a48c88c8af0995cb33aa2970cdfb83dc828cd0b049a8b635f7f206e4 matched before inspection. Required Minecraft/Forge and optional EMI/JEI ranges accept existing pins; no added dependencies.
- Isolated content scan: 955 files, 396 classes, zero flags/errors/approvals. Metadata gate: 206 metafiles, zero flags/errors.
- README count is 197; FEATURES, native showcase and decision documentation updated. Rehash/verify and LF checks passed. Malware/packwiz tests 34/34; showcase tests 21/21.
- Native command via fake player at (444,240,-3), facing south, built all 13 sections at origin (400,240,0); builder returned no problems. Four ordinary and four keyhole archway blocks found. Saved-world NBT confirms the Cross Beam sample at (420,240,18).
- All 525 storage assertions passed. No new warning/error groups compared with the prior check-10 run, whose index hash 50694dd5b67232b2211c44f3cd424fb1ffdb1a1906961c825c212a3f176bae71 exactly matches main at ace7be9eda7a41b1d323f633b254a076cd858913.
- Deviations: first setup lacked cached storage jars (reused baseline jars, no extra download). Two actual boots: first probe failed on unmapped FakePlayer.setYRot; second built successfully but its extra legacy _cross block-ID assertion was wrong. Original failed reports retained; corrected acceptance uses persisted WindowCrossBeams NBT from the same stopped world. Corrected live probe was not rerun. acceptance.cjs passes and writes acceptance.json.
- Both server processes stopped. No client run; owner should inspect archway openings and Cross Beam/material appearance. No pack showcase section added because Roundwood owns its command.
