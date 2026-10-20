---
id: dk-6cdfd3c2
type: task
created: 2026-10-16
status: todo
since: 2026-10-16
area:
priority: P3
rank: zz
parent:
fixes: []
blocked_by: []
relates: []
---
# Decouple Mods menu placement from CLEAN button state


The EMI Mods menu (mods_menu.js, priority 45) places itself by reading `ns.ui.button`, the CLEAN/ALL button state owned by button.js (priority 50). That is a hidden sibling dependency through a mutable namespace field, safe only because of script priority order.

Direction: placement.js holds a registry of anchor/avoid rects (e.g. `ns.placement.avoidRects`) that button.js publishes to and the menu reads, so the menu depends on placement rather than on the button.

Acceptance: mods_menu no longer reads ns.ui.button; behaviour unchanged in game; emi_curation tests pass.

Source: abstraction lens, push review 2026-10-16.
