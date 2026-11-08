---
id: dk-178f1bfe
type: task
created: 2026-11-08
status: todo
since: 2026-11-08
area:
priority: P3
rank: zzzzzzzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Unify the world-manifest generation used by CopyWorld on both machines


The world manifest (sha256 per file, sorted, session.lock excluded) is generated twice: `Get-LocalManifest` in `scripts/server/anu-world-lib.ps1` (Valhalla) and the Manifest operation in `scripts/server/server-ctl.ps1` (ANU). CopyWorld compares the two outputs, so any drift between them breaks verification.

Direction: one portable manifest module (a Node helper under `tools/world_server/`, which both machines already have, or a shared dot-sourced script shipped with the controller) used by both sides.
