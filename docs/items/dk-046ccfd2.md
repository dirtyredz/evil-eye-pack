---
id: dk-046ccfd2
type: bug
created: 2026-11-08
status: done
since: 2026-11-11
area:
priority: P2
rank: zzzzzzzzzzzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# anu-world-server Deploy: call Windows tar explicitly (Git Bash tar breaks on C: paths)

2026-11-08: Deploy run from a Git Bash shell picked /usr/bin/tar, which parses 'C:/...' as a remote host ('Cannot connect to C: resolve failed') and the deploy stopped after the server had already been stopped. Fix: in scripts/server/anu-deploy-lib.ps1 call $env:SystemRoot\System32\tar.exe (or Join-Path) instead of bare 'tar', and make Deploy refuse/restart-safe so a failed deploy never leaves the server stopped (e.g. Start on failure). Add a test or dry-run check that resolves the tar binary.
