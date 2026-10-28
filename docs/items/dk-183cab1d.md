---
id: dk-183cab1d
type: idea
created: 2026-10-28
status: todo
since: 2026-10-28
area: mod-map
priority: P3
rank: zzzzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Split mod map run.cjs option parsing and evidence validation if it grows

tools/mod_map/run.cjs orchestrates the mod map build: CLI option parsing, output/input path guards, saved-evidence validation (inputs.json identity and pins, boot.json completeness) and the pipeline. It is small today; if it grows, extract option parsing and evidence validation into their own modules. Raised by the 2026-10-28 mod-map push structure review.
