---
id: dk-cfc6fbe7
type: bug
created: 2026-10-23
status: todo
since: 2026-10-23
area:
priority: P1
rank: t
parent:
fixes: []
blocked_by: []
relates: []
---
# Pack test ANU agent keeps running after losing its lock lease


From the 2026-10-23 push sign-off (Sol, PASS with P1 debt): `tools/pack_test/remote/agent.cjs` (heartbeat at ~line 28) logs heartbeat ownership failures and keeps running after another launcher takes over its stale lease. A suspended or delayed old agent that resumes can then overlap a newer pack test on ANU.

Fix direction: treat lost ownership as terminal (stop the run, report it as an infrastructure failure, exit 2) and bind refreshes to an immutable claim generation (for example a claim id written at acquire time and checked on every refresh) so an old agent can never reassert the lease. Add tests for both.
