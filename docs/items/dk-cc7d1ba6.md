---
id: dk-cc7d1ba6
type: bug
created: 2026-11-08
status: wip
since: 2026-11-08
area: mods
priority: P1
rank: zzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Recipe-fill routing shadows Dank transfers when Tweaks has no ingredients

Evil Eye Client 0.15.1 replaced DankEmiTransferHandler with its Tweaks handler even at 0 Tweaks batches, so Dank-only "+" fills were disabled (diagnosis: diag-jei-dank worktree .tmp/diag-report.md; 19 takeovers, 4 zero-batch in the Stable log).

Fix implemented (not merged): EvilEyeClient branch fix/dank-plus-fill commit b1f0bab, version 0.15.2. Zero-batch preview with no pending request keeps the selected handler; positive preview stays Tweaks; pending exclusion unchanged; route re-read at click time. Provisional pin on pack branch pin/client-0.15.2 (SHA-256 6d0a411e...fb36, Valhalla build; re-pin to ANU bytes after merge).

Verified: RecipeFillRoutingTest (7 tests) and test build verifyReleaseJar pass. NOT verified: real EMI handler selection (no unit seam), in-game Dank-only fill, GameTests, client-mixin audit, smoke. The five unsupported responses are out of scope and not claimed fixed.
