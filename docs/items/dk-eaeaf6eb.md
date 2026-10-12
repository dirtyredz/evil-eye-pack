---
id: dk-eaeaf6eb
type: task
created: 2026-10-12
status: todo
since: 2026-10-12
area: tools
priority: P2
rank: y
parent:
fixes: []
blocked_by: []
relates: []
---
# Retire or split migrate_rei.cjs so it stops pinning live curation counts

Baseline review 2026-10-12 (componentization + abstraction). migrate_rei.cjs --check pins EXPECTED_TOTAL=1759 and per-group counts against the live hand-curated config/emi-curation/*.json, and re-declares SCHEMA/ID_RE/list validation that policy.compile owns (policy.js:9, :49-61). docs/emi.md repeats the counts.
Why: any normal curation edit breaks --check; two validators can drift.
Direction: retire it with the fixture (archive a record in docs), or split into a historical import plus a list-integrity check that loads policy.compile via harness.cjs loadScripts; keep exact counts only for the frozen fixture.
