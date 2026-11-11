---
id: dk-b59d11ce
type: task
created: 2026-11-11
status: todo
since: 2026-11-11
area:
priority: P2
rank: zzzzzzzzzzzzzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Use tomlSection for the hand-rolled TOML sections in pack_contract.test.cjs

Push review 2026-11-11 (abstraction P2, widened by sign-off): tools/testing/pack_test/tests/data/pack_contract.test.cjs extracts TOML sections by hand in two places added by dk-a42bb3a4: the rail/left-effects contract (~line 52) and the [health.hearts] heart-palette contract (~line 59, split + match), although the same file already has a `tomlSection` helper (a `const` at ~line 144, defined after its first would-be callers). Move `tomlSection` above the first test that uses it and route both contracts through it; tools/packwiz/tests/install/owned_keys/pack_owned_keys.test.cjs:73 parses `colors` the same way — share the helper if it fits without coupling the two suites. Acceptance: no hand-rolled section extraction left in pack_contract.test.cjs; test count unchanged and passing.
