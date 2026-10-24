---
id: dk-a577aca8
type: task
created: 2026-10-24
status: done
since: 2026-10-24
area:
priority: P2
rank: zzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Pack test: mirror source folders in tools/pack_test/tests/


From the 2026-10-24 push review (topology lens, P2): `tools/pack_test/tests/` holds 19 flat test files, over the ~12 fan-out cap. Mirror the source split with `tests/checks/`, `tests/remote/`, `tests/verdict/` and `tests/session/`, and update the test-run glob in STRUCTURE.md and docs/development.md. Alternatively, record "flat by design" in the Layout bullet.
