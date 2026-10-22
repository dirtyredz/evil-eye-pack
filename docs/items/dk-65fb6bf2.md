---
id: dk-65fb6bf2
type: task
created: 2026-10-22
status: todo
since: 2026-10-22
area:
priority: P2
rank: zzw
parent:
fixes: []
blocked_by: []
relates: []
---
# Extract a shared screen-button helper for the EMI toolbar buttons


ui/button.js and ui/decor_button.js copy the same widget lifecycle (ui() holder, update, onScreenInit Button builder + press handler resolving global.emiCuration, onScreenRender, refresh, guarded handler table, Init.Post/Render.Pre registration); only width, label source, press action and preferred spots differ.

Direction: add makeScreenButton({ width, label, canPress, onPress, spots }) beside placement.js and make both files thin configs. Source: abstraction + componentization lenses, push review 2026-10-22.
