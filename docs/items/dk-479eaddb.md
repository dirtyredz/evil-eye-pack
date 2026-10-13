---
id: dk-479eaddb
type: idea
created: 2026-10-12
status: todo
since: 2026-10-12
area: packwiz
priority: P3
rank: y
parent:
fixes: []
blocked_by: []
relates: []
---
# Split packwiz ignore matcher out of pack_index.cjs if it grows


`tools/packwiz/pack_index.cjs` (197 lines) holds the `.packwizignore` matcher, TOML codecs, hashing and git listing. Cohesive for now.

Acceptance: when it grows, extract the ignore matcher to `packwiz/ignore.cjs`; also extract `checkMetafiles`/`checkJars` helpers in `verify_hashes.cjs` if more checks are added.

Source: componentization-lens, push review 2026-10-12.
