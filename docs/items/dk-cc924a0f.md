---
id: dk-cc924a0f
type: idea
created: 2026-10-24
status: todo
since: 2026-10-24
area:
priority: P3
rank: zzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Pack test: nest remote/ transport files when the next remote module lands


From the 2026-10-24 push review (topology lens, P2): `tools/pack_test/remote/` has 11 entries (9 code files, `anu-readme.md`, `lease/`), just over the ~10 screen-fit target. When the next remote file arrives, put the transport files (`ssh`, `sync`, `scripts`, `provision`) in a grouping folder next to `lease/` instead of adding a sibling. Mirror it in `tests/remote/`.
