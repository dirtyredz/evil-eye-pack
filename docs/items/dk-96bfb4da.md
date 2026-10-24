---
id: dk-96bfb4da
type: task
created: 2026-10-23
status: done
since: 2026-10-24
area:
priority: P2
rank: zzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Docs: architecture for the pack test and the ATO doc name


From the 2026-10-23 push review (all three lenses, P2):

- There is no `docs/ARCHITECTURE.md`. The pack-test data flow (stage, probe, evidence, checks, baseline) and the Valhalla/ANU protocol (`job.json`, `status.json`, heartbeat lock, capacity decision) live only in header comments and `docs/development.md`. Add `docs/ARCHITECTURE.md`, or state in STRUCTURE.md which doc is the architecture doc.
- `docs/ato-retirement.md` now documents the dedup survivors (the migration was abandoned); decide whether to rename it and update links in STRUCTURE.md, `docs/emi.md` and `README.md`.
- STRUCTURE.md `Last full review: 2026-10-12` predates pack_test, the server_smoke refactor and the ATO removal: run a baseline review (`/gate review-all`) when the owner wants one.
