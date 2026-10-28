---
id: dk-8f7a6d0f
type: task
created: 2026-10-28
status: done
since: 2026-10-28
area: pack
priority: P2
rank: zzzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Pack trim batch: remove mods the owner picked


The owner is going through the mod list to cut load time and picks mods to remove.
Collect them here and remove them as one batch when the owner says go. Not before.

## To remove

- **Common Capabilities** (`mods/common-capabilities.pw.toml`, CommonCapabilities-1.20.1-2.9.11). Checked 2026-10-28: none of the 197 jars in Evil Eye Local declares it as a dependency. Only its own mods.toml names it. Everlasting Abilities needs only Cyclops Core. Its usual users (Integrated Dynamics/Tunnels) are not in the pack.
- **RFTools family + McJtyLib**: `rftools-base`, `rftools-builder`, `rftools-control`, `rftools-dimensions`, `rftools-utility`, `mcjtylib` (check the exact `.pw.toml` names). Checked 2026-10-28: no other jar depends on them. About 2.4 s of load time. The Stable world "New World" has `data/RFToolsDimensions.dat` but no RFTools dimension folders. Placed RFTools blocks and their contents will be lost. Cleanup: the RFTools entries in `kubejs/config/dedup.json` and `kubejs/assets/emi/index/stacks/dedup.json`, `config/emi-curation/creative.json` and `rules.json` (plus `tools/emi_curation/tests/policy.test.cjs`), `tools/dedup/hidden_reasons.json`, `tools/pack_test/data/baseline.json` and `policy.json`, any RFTools configs, and the docs (`emi-coverage.md` rows, `emi.md` workstation check, README).
- **Iron Furnaces** (`mods/iron-furnaces.pw.toml`, ironfurnaces-1.20.1-4.1.8): requested by the owner on 2026-10-28. No other jar depends on it. About 0.24 s of load time. Placed furnaces and their contents will be lost. Cleanup: the ironfurnaces entries in `kubejs/config/dedup.json` and `kubejs/assets/emi/index/stacks/dedup.json`, `tools/dedup/hidden_reasons.json`, `tools/pack_test/data/baseline.json`, the 10 `config/adchimneys/Emitters/ironfurnaces$*.cfg` files, any `ironfurnaces` config, and the `docs/emi-coverage.md` row.
- **Chunky** (`mods/chunky-pregenerator-forge.pw.toml`, Chunky-1.3.146): requested by the owner on 2026-10-28. No other jar depends on it, and no pack file references it. About 0.01 s of load time. Removing it costs no world data, because chunks it already generated stay. Cleanup: the `config/chunky` config, if one exists.
- **Charging Gadgets** (`mods/charging-gadgets.pw.toml`, charginggadgets-1.11.0): requested by the owner on 2026-10-28. No other jar depends on it, it needs no library, and no pack file references it. About 0.02 s of load time. Placed chargers and their contents will be lost. Cleanup: the `charginggadgets` config, if one exists.
- **Tesseract + SuperMartijn642 Config Lib** (`mods/tesseract.pw.toml`, tesseract-1.0.38; `mods/supermartijn642s-config-lib.pw.toml`): requested by the owner on 2026-10-28. No other jar depends on Tesseract. Config Lib is required only by Tesseract, so it goes too. **Keep SuperMartijn642 Core Lib**, because Additional Lanterns and Connected Glass need it. About 0.46 s of load time for Tesseract. Placed tesseracts will be lost. Cleanup: `config/tesseract-common.toml`, the `tesseract` entries in `config/jade/plugins.json` and `config/jade/sort-order.json`, and any Config Lib config.

## Kept after checking

- **Polymorph**: keep. The 2026-10-28 scan (job `2026-10-28-recipe-conflicts`) found 770 recipe conflicts it resolves.
- **HammerMultipart**: HammerMicroblocks calls its classes directly, even though the dependency is undeclared. The Hammer mods stay or go as a set.
- **TRansition / TRender**: bundled inside Entity Culling and 3D Skin Layers. They cannot be removed separately.

## Acceptance

- Each listed mod's `.pw.toml` is removed, along with any config it alone owned. Run rehash and verify_hashes.
- One headless server smoke boot passes, run after any other heavy job has finished.
- Update docs that mention the removed mods (README, emi-coverage and so on).

## Evidence (2026-10-28)

- Implemented and pushed: main `f33dc9c` (fast-forward from `79955c4`), pushed to origin.
- Removed 12 mod metafiles and 19 configs only they owned. Cleaned up the dedup, EMI, Jade, pack-test and doc references. SuperMartijn642 Core Lib kept.
- `rehash.cjs`: +0 -31 ~6. `verify_hashes.cjs`: OK 0 mismatches, 1171 entries.
- Unit tests (dedup, packwiz, emi_curation, pack_test): 289/289 pass.
- ANU pack-test boot: Done in 129.6 s. Recipes, references, machines, crafting, dedup and malware all passed. No removed mod ids appear. It exits 1 only on 50 Roundwood `no-known-source` findings that predate the trim. Evidence: `artifacts/evil-eye-pack/jobs/2026-10-28-pack-trim/packtest/run-2026-10-28T16-30-05-170Z/`.
- Structure sign-off (Sol high): PASS.
- Delivery: published to main. Not yet confirmed installed in Stable. Stable picks it up on its next launch.
