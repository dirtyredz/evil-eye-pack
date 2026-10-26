---
id: dk-4feb2b1d
type: task
created: 2026-10-25
status: todo
since: 2026-10-25
area:
priority: P3
rank: zzzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Showcase check: split log-group reporting and host-JVM wait out of check.cjs


From the 2026-10-25 structure review (componentization lens, P2). tools/showcase/check.cjs also owns log-group normalisation and comparison (logGroups, newLogGroups, scriptErrors), waitForServer, baseline extraction and staging. logGroups and waitForServer are exported only so tests can reach them.

Acceptance: report.js (log groups, compare, verdict) and host_guard.cjs (waitForServer) are extracted, and check.cjs keeps argument parsing and orchestration only.
