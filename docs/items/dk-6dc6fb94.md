---
id: dk-6dc6fb94
type: task
created: 2026-10-20
status: wip
since: 2026-10-20
area: server-smoke
priority: P2
rank: zy
parent:
fixes: []
blocked_by: []
relates: []
---
# Make server smoke boots repeatable with a --seed option


`tools/server_smoke/smoke.cjs` boots a fresh world with an empty `level-seed`, so every run uses a random seed. On 2026-10-20, two of four boots of the same pack stalled at "Preparing spawn area" (one timed out at 600 s, one at 1500 s after sitting at 26% for ~15 min) with 0 crashes and 0 new errors. The other two (with and without dank_recipe_transfer) reached Done in 2–3 min server time. The stall is most likely seed-dependent worldgen; not proven (no thread dump was captured). Runs: C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-10-20-dank-recipe-transfer-pack/ (smoke, smoke2 stalled; smoke3, smoke4 passed).

Do:
- Add `--seed <n>` that writes `level-seed=` into server.properties; default to a pinned known-good seed so smokes are deterministic.
- Print the seed in every run's summary, and especially on timeout.
- When a run stalls in "Preparing spawn area" with no new error groups, report it as a worldgen stall (and optionally retry once on another seed), not as a pack FAIL.
- Optional: on a stall, capture `jcmd <pid> Thread.print` before the timeout kill, to pin the cause.

Acceptance: two consecutive runs with the same `--seed` behave the same; the seed appears in the output; a stalled run is labelled as a worldgen stall with the seed; docs/development.md documents the flag.
