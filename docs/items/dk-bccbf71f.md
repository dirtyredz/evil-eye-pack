---
id: dk-bccbf71f
type: task
created: 2026-10-12
status: done
since: 2026-10-20
area: emi-curation
priority: P3
rank: w
parent:
fixes: []
blocked_by: []
relates: []
---
# Move test fixture data out of harness.cjs


`tools/emi_curation/tests/harness.cjs` mixes the vm script loader with world fixture data (`fixture()`, ZOMBIE/VILLAGER NBT, stack and recipe tables).

Acceptance: fixture data lives in `fake_emi.cjs` or a `fixture.cjs`; harness keeps loader + `boot`.

Source: componentization-lens, push review 2026-10-12.
