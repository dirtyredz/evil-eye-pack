---
id: dk-79a46fbd
type: task
created: 2026-11-11
status: todo
since: 2026-11-11
area:
priority: P2
rank: zzzzzzzzzzzzzzzzw
parent:
fixes: []
blocked_by: []
relates: []
---
# Relieve tools/packwiz/install and tests/install breadth


Push review 2026-11-11 (topology P2s), both at the cap after today's install work:

- tools/packwiz/tests/install/ holds 12 flat test files (owned_options and mod_rewritten_configs took it there). Mirror the source split: move the two check tests into tests/install/checks/, and/or group the three pack-owned-keys tests (pack_owned_keys, owned_options, mod_rewritten_configs) together.
- tools/packwiz/install/ has 11 entries (8 code files, pack-owned-keys.json, checks/, targets/), past the ~10 breadth target. Move the owned-keys pair (pack_owned_keys.cjs + pack-owned-keys.json) or the instance-model files (instance_cfg, instance_targets, installed_files) into a responsibility subfolder.

Acceptance: each level ≤10 entries; STRUCTURE.md tree, Layout bullets, Components rows and every test glob updated; Stable prelaunch check, dry-run and packwiz tests pass.
