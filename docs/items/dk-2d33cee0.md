---
id: dk-2d33cee0
type: bug
created: 2026-10-30
status: todo
since: 2026-10-30
area: migration
priority: P1
rank: zzzn
parent: dk-876bc6ca
fixes: []
blocked_by: []
relates: [dk-d4a36381]
---
# Steam 'n' Rails keybind mixin targets the pre-1.21 package


Steam 'n' Rails NeoForge 1.21.1 emits a missing-target warning for client.MixinKeyBindsListKeyEntry. Both the pinned latest 0.3.0-beta.2 jar and stable v0.2.1 source target net.minecraft.client.gui.screens.controls.KeyBindsList$KeyEntry, but Minecraft 1.21.1 places the class at net.minecraft.client.gui.screens.options.controls.KeyBindsList$KeyEntry.

The unapplied WrapOperation normally prevents Railways entries in CRKeys.NON_CONFLICTING_KEYMAPPINGS from being shown as conflicting with one another in the Controls screen. It is not a crash risk, but it is lost client behaviour and therefore cannot enter the harmless client-mixin allow-list.

Evidence: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-client-mixin-triage/jade-15.10.3-without-drt/report.json and console.log. Upstream source: Porters-of-Railways/Railway-1.21.1, src/main/java/com/railwayteam/railways/mixin/client/MixinKeyBindsListKeyEntry.java at tags v0.2.1 and v0.3.0-beta.2.

Acceptance: an upstream NeoForge 1.21.1 artifact corrects the target (and injection point if required), the pack locks that verified artifact, and the DRT-excluded client-mixin check reports no new missing target for railways-common.mixins.json.

## Trial disposition (2026-10-31)

The orchestrator accepted this as a known minor cosmetic issue for the owner trial: Railways keybinds may appear conflicting on the Controls screen; there is no crash risk. The exact current mod/config/mixin/target tuple is separately marked known-minor in tools/client_mixin/allowlist.json with this Docket id, so any changed or additional finding still fails. Keep this item open and re-check on a new Railways build.

Complete-pin evidence: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-31-drt-021/client-audit-all-pins/report.json (PASS; 1,819/1,819 targets verified).

## Notes

### 2026-11-11T01:12:57.351Z · open · agent

Re-checked 2026-11-10: no new upstream release (latest v0.3.0-beta.2, 2026-07-27). The default branch (last commit 2026-09-25) still has @Mixin(targets = "net.minecraft.client.gui.screens.controls.KeyBindsList$KeyEntry"), so nothing to lock yet. Options for the owner: file an upstream issue/PR, or carry the corrected mixin in an owned mod.

### 2026-11-11T15:35:24.282Z · open · agent

2026-11-11: implemented and pinned (not yet pushed). EvilEyeClient 0.15.10 (main 325f0a0) carries a corrected mixin on options.controls.KeyBindsList$KeyEntry, gated on railways being loaded. Release neoforge-1.21.1-v0.15.10, sha256 385bcdc5…8b9d. Pack pin afa7fcb, merged locally. Headless client mixin audit PASS: the new config is VERIFIED on the 1.21.1 target; Railways' stale warning stays allow-listed. States: implemented and pinned; NOT yet pushed to Stable; NOT confirmed in game (owner: the Controls screen should no longer show Railways keys conflicting).
