---
id: dk-f561bc7f
type: task
created: 2026-10-25
status: todo
since: 2026-10-25
area:
priority: P3
rank: zzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Showcase: split the section registry out of plan.js when the next section helper lands


From the 2026-10-25 structure review (componentization lens, P2). plan.js carries the section registry with its reserved-name rules, plan validation, the plan DSL and placement math. That is fine at its current size.

Acceptance: when the next section helper is added, the registry and validation move to registry.js, and plan.js keeps the DSL and placement.
