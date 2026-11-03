---
id: dk-b2b6fb44
type: task
created: 2026-11-03
status: todo
since: 2026-11-03
area: packwiz
priority: P2
rank: zzzzzzzzzzzzzw
parent:
fixes: []
blocked_by: []
relates: []
---
# Ship Client 0.9.0's generated config bytes or reword the decision note


Sign-off 2026-11-03. `config/evileye_client-client.toml:422-439` new [fps] block lacks the `#Allowed Values` comment other choice keys carry: the file is now hand-merged, while config-decisions.json claims it is the NeoForge-written default. Harmless (file is preserve) but the documented claim is false.

Direction: generate 0.9.0's default config (GameTest/client run) and ship those bytes, or reword the decision note as hand-merged.
