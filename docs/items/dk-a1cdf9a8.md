---
id: dk-a1cdf9a8
type: task
created: 2026-11-09
status: todo
since: 2026-11-09
area: world-server
priority: P2
rank: zzzzzzzzzzzzzzz
parent:
fixes: []
blocked_by: []
relates: []
---
# Auto-start the ANU world server after a reboot


ANU rebooted without warning on 2026-11-06 at 12:02 and again on 2026-11-09 at 08:49 (Kernel-Power 41 and EventLog 6008, with no crash dump; it looks like power loss or a hard reset). Each time, the Evil Eye world server (`G:\evil-eye-pack-ci\server`, `server\ctl\server-ctl.ps1`) stayed down until someone started it by hand.

The owner approved a start-at-boot job on 2026-11-09. Owner rules say it must be registered through Command Deck's schedule tool, never `schtasks` or `Register-ScheduledTask`. It is blocked because Command Deck can't schedule on ANU yet: on 2026-11-09, `discover` returned `SCHEDULE_UNAVAILABLE` for ANU's task scheduler, coverage state `never`.

Acceptance:
- A Command Deck-managed schedule on ANU starts the server at boot by running `server-ctl.ps1 -Op Start`, at BelowNormal priority, as a hidden window.
- It stays clear of Plex, the `cd-ci` runner and `G:\Work`.
- After a test reboot, or a simulated boot trigger, the server reaches `Done` without anyone starting it.

Also for the owner: check ANU's power path (outlet, power strip, UPS, PSU, heat).
