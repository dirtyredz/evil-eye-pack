---
id: dk-cc7d1ba6
type: bug
created: 2026-11-08
status: done
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

Evil Eye Client 0.15.1 replaced DankEmiTransferHandler with its Tweaks handler even at 0 Tweaks batches, so Dank-only "+" fills were disabled (diagnosis: diag-jei-dank worktree, dk-9aa94c48; 19 takeovers, 4 zero-batch in the Stable log).

Fix: EvilEyeClient 0.15.2, commit b1f0bab (merged to EvilEyeClient main). A zero-batch preview with no pending request keeps the selected handler; a positive preview stays Tweaks; pending exclusion unchanged; the route is re-read at click time.

Evidence record (2026-11-08):
- Reproduced: Dank-only "+" did nothing on Client 0.15.1 (Stable log: 4 zero-batch takeovers).
- Before/after: RecipeFillRoutingTest (7 tests) added with the fix; owner confirmed in game on test jars (Stable plus ANU server) that the Dank "+" fills again.
- Final pins, ANU-built from merged mains (EvilEyeClient b1f0bab, EvilEyeTweaks 3c2eab2, DankRecipeTransfer e7494da):
  - Client 0.15.2 SHA-256 62f77bdfbdc99dce680e01ed1ba039807783c1827b0092ddaac7dbcbfc1efdf7 (812530 bytes)
  - Tweaks 0.14.5 SHA-256 0ff3939e3d142eea37095e681b904fb7c431fc60462142a150d6a8143f4b3dab (565683 bytes)
  - Dank Recipe Transfer 0.2.2 SHA-256 fc627285c60f469c70620d05bea2a2e5eb0eb134665def8482b1935b4c13f0d4 (120947 bytes)
- Integrated check: pack rehash, verify_hashes (0 mismatches) and tools/packwiz tests (66 pass); ANU `build` per mod.
- States: implemented and pinned in the pack; confirmed in game on the test jars, not yet on these exact ANU bytes (Stable prelaunch and ANU server redeploy follow the merge). Not run: GameTests, client-mixin audit.
- Diagnosis reports (diag-report.md, diag2-report.md): the pack has no home for diagnosis reports, so copies are kept in artifacts/evil-eye-pack/jobs/2026-11-08-dank-plus-fix/ and summarised here and in dk-9aa94c48. The five unsupported responses are out of scope and not claimed fixed.
