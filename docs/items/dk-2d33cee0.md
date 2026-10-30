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
