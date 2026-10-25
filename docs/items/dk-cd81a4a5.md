---
id: dk-cd81a4a5
type: task
created: 2026-10-24
status: todo
since: 2026-10-24
area:
priority: P3
rank: zzzzzzt
parent:
fixes: []
blocked_by: []
relates: []
---
# Malware guard: move the shared data path out of policy.cjs


From the 2026-10-24 second sign-off (Sol, P2): `tools/malware_guard/scanning/scan.cjs:7` and `tools/malware_guard/gate.cjs:4` import the approval-policy module only for the shared data-directory path. That leaves a small dependency from raw detection toward approval policy, even though the boundary is otherwise clean.

Direction: move the data path into a neutral constants module (for example `tools/malware_guard/data_path.cjs`), or resolve each detector's data path locally.
