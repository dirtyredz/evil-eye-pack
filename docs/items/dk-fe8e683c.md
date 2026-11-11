---
id: dk-fe8e683c
type: task
created: 2026-11-07
status: done
since: 2026-11-11
area:
priority: P3
rank: zzzzzzzzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Push 2026-11-07 sign-off P2s: STRUCTURE rows for localTarget/owned keys, local-instance -Cache default via env.cjs, prepareFiles import

Sign-off P2s (PASS) on 06cd6ab: STRUCTURE.md:215 instance_targets row lacks localTarget/LOCAL/MAIN_CHECKOUT; STRUCTURE.md:223 pack_owned_keys row should say every target incl. Local; scripts/instances/local-instance.ps1:30 -Cache default hardcodes world-trial-final cache path (fold with dk-717ef281); local_target.cjs requires prepareFiles inside main() though install_pack.cjs is imported at top.
