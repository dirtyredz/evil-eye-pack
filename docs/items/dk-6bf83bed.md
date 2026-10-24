---
id: dk-6bf83bed
type: task
created: 2026-10-24
status: todo
since: 2026-10-24
area:
priority: P3
rank: zzzzzw
parent:
fixes: []
blocked_by: []
relates: []
---
# EMI: remove the recipeState migration shim in recipe_view.js


From the 2026-10-24 push review (abstraction lens, P2). `kubejs/client_scripts/emi_curation/recipe_view.js:16-21` adopts the old `ns.state.recipe` once (`ns.recipeState || ... ns.state.recipe`, then `delete ns.state.recipe`), and `tools/emi_curation/tests/session.test.cjs:298` simulates that old shape. It's permanent migration code for a layout that no longer exists after the first reload, and it couples `recipe_view` to `session`'s state holder.

Direction: once the change has shipped and been reloaded in play, remove the adoption branch and its test. Low risk; needs an in-game reload check.
