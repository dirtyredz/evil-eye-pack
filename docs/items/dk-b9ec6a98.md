---
id: dk-b9ec6a98
type: task
created: 2026-10-12
status: done
since: 2026-10-21
area: emi-curation
priority: P3
rank: zw
parent:
fixes: []
blocked_by: []
relates: []
---
# Add interop.filterToList / mapEach for the Rhino-safe Java list loops

Baseline review 2026-10-12 (abstraction). The snapshot-to-ArrayList, index-loop, keep-if, freeze shape is repeated in index_view.js buildClean (:22-31), recipe_view.js filtered (:63-76) and the key-set builder.
Why: three copies of a documented GOTCHAS footgun.
Direction: interop.filterToList(javaList, keepFn) and interop.mapEach(javaList, fn); call from both views.

mapEach not added; the only other site (hiding.js buildKeySet) builds a set, not a list; follow-up tracked in dk-54fe7545.
