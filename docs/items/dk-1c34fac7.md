---
id: dk-1c34fac7
type: bug
created: 2026-11-10
status: done
since: 2026-11-10
area: world-server
priority: P1
rank: zzzzzn
parent:
fixes: []
blocked_by: []
relates: []
---
# Make scheduled world-server detection idempotent and guard deployed mod parity

Diagnose the ANU 2026-11-10 scheduled Start exit 2 without changing scheduled tasks or stopping/starting the live JVM. Fix controller detection if responsible, cover hidden command lines with safe regression tests, and add a cheap deployed server mod parity guard shared with staging. Update development/GOTCHAS, run the dispatched fast gate, and leave deployment to the orchestrator.
