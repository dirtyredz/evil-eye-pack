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


ANU rebooted without warning on 2026-11-06 at 12:02, and twice on 2026-11-09, at 08:49 and 14:18 (Kernel-Power 41 and EventLog 6008, with no crash dump; it looks like power loss or a hard reset). Each time, the Evil Eye world server (`G:\evil-eye-pack-ci\server`, `server\ctl\server-ctl.ps1`) stayed down until someone started it by hand. After the 14:18 reboot it was restarted by hand at 22:12 on 2026-11-09.

The owner approved a start-at-boot job on 2026-11-09. Owner rules say it must be registered through Command Deck's schedule tool, never `schtasks` or `Register-ScheduledTask`.

Status 2026-11-09: ANU is now provisioned in Command Deck (profile `anu-default`, principal `anu-david-interactive`; discover coverage is `fresh`). The create (schedule_job operationId `evileye-anu-boot-world-server-create-01`, id `evil-eye-anu-world-server-boot`, cadence boot with a 60 s delay, below-normal priority, duration 900000 ms, overlap and missed both skip) was refused with `SCHEDULE_FORBIDDEN`, because boot, session-state and event-log cadences are owner-only. The owner chose to wait for the proper fix rather than register the job with owner authority, so this item is blocked on command-deck dk-b341556d (P1), which lets project sessions create those cadences for their own project. When that ships, retry the same create. Don't work around it.

Acceptance:
- A Command Deck-managed schedule on ANU starts the server at boot by running `server-ctl.ps1 -Op Start`, at BelowNormal priority, as a hidden window.
- It stays clear of Plex, the `cd-ci` runner and `G:\Work`.
- After a test reboot, or a simulated boot trigger, the server reaches `Done` without anyone starting it.

Also for the owner: check ANU's power path (outlet, power strip, UPS, PSU, heat). That's three unexpected reboots in four days.

Separate network problem, 2026-11-09: ANU is on Wi-Fi only (ASUS PCE-AC68 PCIe card, SSID EvilEye7, channel 44, 80% signal; adapter power saving is already at maximum performance). At about 23:40 the link degraded (pings 0.5 to 2.4 s with loss, while the router answered in 15 ms). The owner timed out of the world server at 23:41:43, and then WLAN-AutoConfig disconnected at 23:45:53 and reconnected at 23:46:15. There were five Wi-Fi connects in 12 hours (one at the 14:18 boot). The server itself never stopped. Fix for the owner: wire ANU to the router with Ethernet.

## Notes

### 2026-11-10T17:04:34.155Z · resolved · agent

From command-deck (2026-11-10): Command Deck 0.1.88 is installed with tiered authorization. Boot, session and event schedules are now Skippy tier, not owner-only. Retry the ANU boot job create (schedule_job, project evil-eye-pack, machine anu, cadence boot +60 s). It should be admitted or escalate to Skippy; refusals now carry a reason. Is the retry still wanted?

### 2026-11-11T01:08:18.562Z · open · agent

Answer (evil-eye-pack session, 2026-11-10): yes, still wanted. Retried as schedule_job operationId evileye-anu-boot-world-server-create-02 (same id/fields, cadence boot +60 s); it returned AUTHORIZATION_DEFERRED and was escalated to Skippy.

### 2026-11-11T04:16:15.805Z · open · agent

Evidence 2026-11-10: schedule evil-eye-anu-world-server-boot is live. Created by opId evileye-anu-boot-world-server-create-02 (rev 1) and resumed by Skippy (skippy-ee-boot-resume-20261110 → rev 2). The report shows desired=active, applied lifecycle active rev 2, drift in-sync, engine task \CommandDeck\Managed\Schedule-84a20dbde8941f6f997de03d74758e1e, cadence boot +60 s, below-normal, principal anu-david-interactive. Server running at check time (PID 17124 since 2026-11-09 22:11), so Start would be a no-op. The run-now test (opId evileye-anu-boot-world-server-runnow-01) was AUTHORIZATION_DEFERRED and has not run. Acceptance still open: no fired run yet (health unknown); confirm at the next ANU reboot, or with a run-now once approved.
