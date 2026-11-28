---
id: dk-cbebb2d9
type: bug
created: 2026-11-28
status: wip
since: 2026-11-28
area: tooling
priority: P1
rank: zzzzzy
parent:
fixes: []
blocked_by: []
relates: []
---
# Nov 19 artifact purge emptied Stable's live install cache

Stable would not launch on 2026-11-28: pre-launch exited 2 with 'Missing pinned jar skinlayers3d-neoforge-1.11.4' because jobs/2026-10-31-world-trial-final/cache (marked KEEP-LIVE-STABLE-CACHE) had been emptied on 2026-11-19 22:48 CT. Probable cause: the artifacts purge-job-binaries.cmd (probably the disk-cleanup pass) deletes every jar and empty directory under artifacts/jobs with no guard. Fixed: cache restored by copying artifacts/migration/neoforge-1.21.1/cache (stable-prelaunch.ps1 -DryRun OK); the purge is now scripts/owner/purge-job-binaries.ps1 (-DryRun, skips any folder holding a KEEP-LIVE marker). Open: owner launches Stable to confirm.
