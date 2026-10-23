# Evil Eye pack test on ANU (G:\evil-eye-pack-ci)

Remote target of the Evil Eye modpack's automated pack test (`node tools/pack_test/run.cjs` in the
`evil-eye-pack` repo on Valhalla). Valhalla stages the pack, syncs it here, starts one detached agent,
waits, and pulls the evidence back. Nothing here is a source of truth: every file can be deleted and is
re-sent by the next run. The repo copy of this file is `tools/pack_test/remote/anu-readme.md`.

## Installed (by `node tools/pack_test/remote/provision.cjs`, idempotent)

{{INSTALLED}}

The machine PATH, JAVA_HOME and Defender exclusions are untouched; the agent gets Java through its job
file (SMOKE_JAVA/SMOKE_JCMD set inside the Node process only).

## Layout

- `stage\server\` - the staged Forge server and `-s server` pack install, synced incrementally from
  Valhalla (`.sync-manifest.json` = what was sent; delete it to force a full resend).
- `tools\` - the pack-test code (`tools/server_smoke`, `tools/pack_test`, `tools/emi_coverage`), resent
  every run.
- `runs\<run-id>\` - one run: `job.json`, `agent.log`, `status.json`, `evidence\` (probe payloads, logs,
  crash reports). The throwaway server copy `server\` is deleted when the boot ends. Old runs can be
  deleted at any time.
- `cache\worlds\<key>\` - a generated world reused by later runs with the same mods and seed.
- `lock\owner.json` - single-job lock with a heartbeat (stale after 10 minutes without a refresh).
- `incoming\`, `downloads\` - transfer and installer leftovers; safe to delete.

## How a run works

1. Valhalla takes `lock\` over SSH. If another pack test holds it, the run does not wait: it falls back to
   Valhalla (two pack tests never run here at once). It then reads ANU's load (read only) and picks a mode:
   - **alone** - no other project's job is running (`G:\mods-ci\lock` absent, or its pid dead);
   - **shared** - that job is running, but free RAM is >= 8 GB and the mean of 5 one-second CPU readings is
     < 50%: the pack test runs beside it at BelowNormal (agent and server JVM);
   - **fallback** - that job is running and there is no room (or the probe failed): the run goes to
     Valhalla at once, no waiting.
   The probe reads `G:\mods-ci\lock\pid` and `job` and counts `G:\mods-ci\queue\*.ticket`; it never takes,
   edits or deletes anything there. Thresholds live in `tools/pack_test/remote/config.cjs`
   (`PACKTEST_ANU_MIN_FREE_GB`, `PACKTEST_ANU_MAX_CPU_PCT`, `PACKTEST_ANU_CPU_SAMPLES`).
   A shared run that is starved of CPU is reported HOST STARVED (exit 2, neighbour named) and re-run once
   on Valhalla.
2. It syncs `stage\server\` and `tools\`, writes `runs\<id>\job.json`, and starts
   `node tools\pack_test\remote\agent.cjs runs\<id>\job.json` through `Win32_Process.Create` at
   BelowNormal priority (the Java server inherits it), so it survives the SSH session.
3. The agent copies the stage into `runs\<id>\server\` (jars hard-linked), injects the KubeJS probe,
   boots the server hidden on 127.0.0.1 only (offline, nothing exposed), stops it, keeps the evidence,
   deletes the server copy, refreshes and finally releases the lock.
4. Valhalla polls `status.json`, then pulls `evidence\` back and analyses it there.

## Manual operations

- Status: `Get-Content G:\evil-eye-pack-ci\runs\<id>\status.json`; log: `agent.log`.
- Stop a run: `Stop-Process -Id <agent pid from status.json>`, then `taskkill /PID <java pid> /T /F` if a
  server JVM is left (`Get-CimInstance Win32_Process -Filter "Name='java.exe'"` and match the run path
  in its command line). Then delete `lock\`.
- Clean up: delete `runs\*`, `incoming\*`, `downloads\*`; delete `cache\worlds\*` to force a fresh world.
- Remove everything: delete `G:\evil-eye-pack-ci` and `C:\Tools\evil-eye-pack`.

Never touch: Plex and its `Plex Media Server (boot)` task, `E:\`, `G:\Work`, `C:\ProgramData\CommandDeckCI\`,
the `cd-ci` account, `G:\ci`, `G:\mods-ci` (read only: `lock\pid`, `lock\job`, and the `queue\` ticket count).
