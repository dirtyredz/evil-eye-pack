---
id: dk-063cfdb8
type: idea
created: 2026-10-24
status: todo
since: 2026-10-24
area:
priority: P3
rank: zzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Pack test: move recipe_json and stage_runtime into a shared folder when the next root file lands


From the 2026-10-24 push review (topology lens, P2): `tools/pack_test/` has 11 immediate entries: 4 loose files (`analyze.cjs`, `recipe_json.cjs`, `run.cjs`, `stage_runtime.cjs`) and 7 folders. That's one over the ~10 breadth guide. When the next file or folder lands there, move the neutral helpers `recipe_json.cjs` and `stage_runtime.cjs` into a responsibility folder (for example `shared/`) and update the STRUCTURE.md Components rows. Don't add another sibling.
