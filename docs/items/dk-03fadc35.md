---
id: dk-03fadc35
type: task
created: 2026-10-12
status: todo
since: 2026-10-12
area: packwiz
priority: P2
rank: zn
parent:
fixes: []
blocked_by: []
relates: []
---
# Share isMetafile between rehash and verify_hashes


`isMetafile` lives only in `tools/packwiz/rehash.cjs`; `verify_hashes.cjs` trusts the index's `metafile` flag without checking it, so a wrongly flagged entry passes verify.

Acceptance: `isMetafile` moves to `pack_index.cjs`; verify reports entries whose `metafile` flag disagrees with it.

Source: abstraction-lens, push review 2026-10-12.
