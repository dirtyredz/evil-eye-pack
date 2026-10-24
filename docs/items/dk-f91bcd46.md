---
id: dk-f91bcd46
type: task
created: 2026-10-22
status: done
since: 2026-10-24
area:
priority: P3
rank: zzzzn
parent:
fixes: []
blocked_by: []
relates: []
---
# Toolbar button rect registry in placement.js instead of cross-widget namespace reads


Widens dk-6cdfd3c2: ui/mods_menu.js (otherButtons reads ns.ui.button, ns.decorUi.button) and ui/decor_button.js (reads ns.ui, ns.modsUi) reach into each other's mutable namespace fields; placement works only because of script priority and Forge listener order.

Direction: placement.js keeps a registry of toolbar button rects (register(name, getRect)); each widget reads the registry. Doing this also closes dk-6cdfd3c2. Source: abstraction lens, push review 2026-10-22.
