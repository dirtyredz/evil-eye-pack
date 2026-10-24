---
id: dk-2eea0c2b
type: task
created: 2026-10-24
status: done
since: 2026-10-24
area:
priority: P2
rank: zzzzw
parent:
fixes: []
blocked_by: []
relates: []
---
# Pack test: give the ANU lease a named seam (lease value, ownsLease, startLease)


From the 2026-10-24 push review of b0c1b27 (abstraction and componentization lenses, both P2):

- The lease identity `(owner, claimId)` is passed as two loose positional strings through `refreshDirLock`, `releaseDirLock`, `releaseScript` and `job.json`. The owner-and-claim match is written three times: the PowerShell in `releaseScript`, `check()` in `refreshDirLock`, and `releaseDirLock`. Introduce a `lease = { runId, claimId }` value returned by `acquire` and passed whole, plus one Node `ownsLease(cur, lease)` predicate.
- The heartbeat lifecycle (heartbeat, stop on loss, kill children, exit 2) sits inline in `tools/pack_test/remote/agent.cjs` `main()`, so `lease_loss.test.cjs` has to `vm`-run the script with fake globals. Extract it as `startLease({ job, scope, status, log, exit })` so tests call it directly.
- Topology: `remote/` is at the breadth cap (11 entries). Put the lease cluster (`dir_lock`, the new lease module, the lease scripts) under `remote/lease/` instead of adding siblings. Split `dir_lock.cjs`'s Node side from its launcher side only if it grows.

Acceptance: the lease tests call the extracted function without `vm`, the match logic exists once in Node, and the pack_test tests pass.
