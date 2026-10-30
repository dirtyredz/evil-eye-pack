---
id: dk-ce8a67fc
type: bug
created: 2026-10-30
status: done
since: 2026-10-30
area: migration
priority: P2
rank: zzzzzzzw
parent: dk-876bc6ca
fixes: []
blocked_by: []
relates: []
---
# Resolve CE dreadwood leaves and sapling survival acquisition

Ice and Fire CE 2.1.4 (6118f541, sha256 71fc6472c58d5cba9ae56cd3a37c98bcaed6187c168aef1a76f7ebd1d71a02d0) registers dreadwood_leaves and dreadwood_sapling in IafBlocks. Neither has a loot table or acquisition recipe. The dreadwood configured tree features are only referenced by DreadwoodSaplingBlock, with no natural placed-feature source. Both IDs are new relative to the supplied 1.20 baseline.jar (which has only dreadwood log/planks/lock). Pack-test records exact acquisition baselines, without invented recipes or permanent hides. Hand back to minecraft-mods: supply intended survival data or explicitly designate creative-only. Evidence: jobs/2026-10-30-iaf-integration/boots/run-2026-10-30T06-49-10-194Z/summary.txt; source registry/IafBlocks.java and item/block/DreadwoodSaplingBlock.java. Existing-world IDs are unaffected.

Owner outcome (2026-10-30): designated unfinished creative-only CE content. Both IDs now use config/emi-curation/iceandfire-creative.json in the reversible CLEAN policy; ALL restores them. Regression reproduced before the change and passes afterward; hash verification reports zero mismatches. No recipes or registries changed.
