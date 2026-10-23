---
id: dk-e4cc1e7b
type: task
created: 2026-10-23
status: done
since: 2026-10-23
area: pack-test
priority: P3
rank: zzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Review the bulk-accepted acquisition baseline of the pack test


The first pack-test run (2026-10-23) accepted 439 acquisition gaps into `tools/pack_test/data/baseline.json` with namespace-level reasons ("obtained through mod code"). They were skimmed by namespace, not checked item by item. Review them: move true by-design categories into `tools/pack_test/data/policy.json` exclusions, keep real gaps as findings, and replace bulk reasons with specific ones.

Acceptance: every acquisition baseline entry has an item-specific or category-specific reason; no entry hides an item players are meant to get.
