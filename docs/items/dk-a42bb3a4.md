---
id: dk-a42bb3a4
type: task
created: 2026-11-02
status: todo
since: 2026-11-02
area: tools
priority: P2
rank: zzzzzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Move shipped-config assertions out of pack_owned_keys.test.cjs


Structure review 2026-11-02 (componentization lens). `tools/packwiz/tests/pack_owned_keys.test.cjs` mixes the `setToml`/`tomlValue` unit tests with contract assertions on shipped `config/evileye_client-client.toml` (rail, effects, inventory-action toggles).

Direction: keep the setter tests there; move the shipped-config assertions to `tools/testing/pack_test/tests/data/`.
