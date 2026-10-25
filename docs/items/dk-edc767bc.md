---
id: dk-edc767bc
type: idea
created: 2026-10-24
status: todo
since: 2026-10-24
area:
priority: P3
rank: zzzzzzn
parent:
fixes: []
blocked_by: []
relates: []
---
# Malware guard: runtime outbound-connection watch during the ANU boot (layer 4)


Deferred layer 4 from the 2026-10-24 malware guard design. During the headless ANU pack-test boot, the server runs offline (127.0.0.1), so any outbound network attempt is suspicious. Flag it as a security finding to catch obfuscated payloads that string scans miss. Options are Windows firewall logging on ANU or a Java agent. It must follow the ANU sharing rules: its own folder, never touching Plex or the cd-ci runner, and no machine-wide firewall changes without the owner's OK. The check goes under `tools/pack_test/checks/security/`.
