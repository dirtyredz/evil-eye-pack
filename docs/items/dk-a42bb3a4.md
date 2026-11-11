---
id: dk-a42bb3a4
type: task
created: 2026-11-02
status: done
since: 2026-11-11
area: tools
priority: P2
rank: zzzzzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Move shipped-config assertions out of pack_owned_keys.test.cjs


Structure review 2026-11-02 (componentization lens). `tools/packwiz/tests/install/owned_keys/pack_owned_keys.test.cjs` mixes the `setToml`/`tomlValue` unit tests with contract assertions on shipped `config/evileye_client-client.toml` (rail, effects, inventory-action toggles).

Direction: keep the setter tests there; move the shipped-config assertions to `tools/testing/pack_test/tests/data/`.

Done 2026-11-11: the shipped-bytes, Flywheel, rail/effects and heart-palette assertions now live in `tools/testing/pack_test/tests/data/pack_contract.test.cjs`; the owned-keys test covers the mechanism only. dk-34f9e245 was the same work and is dropped as a duplicate.
