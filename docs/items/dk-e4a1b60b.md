---
id: dk-e4a1b60b
type: task
created: 2026-10-24
status: todo
since: 2026-10-24
area:
priority: P3
rank: zzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# EMI: extract the toolbar rect registry from placement.js when a fourth widget lands


From the 2026-10-24 push review (componentization lens, P2). `kubejs/client_scripts/emi_curation/ui/placement.js` (117 lines) holds three jobs: pure geometry (`chooseRect`, `searchPlaced`, `overlaps`), the live EMI layout reader (`layoutContext`, `usableLayout`), and the toolbar rect registry (`register`, `rect`, `rects`, `visibleRect`). The placement order still depends on Forge listener registration order, set by script priority.

Direction: leave it whole now. When a fourth toolbar widget arrives, extract the registry into a small `toolbar.js` that declares the widget names and order once.
