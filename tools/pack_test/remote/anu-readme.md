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

1. Valhalla takes `lock\` over SSH, waiting while another of our runs or a live `G:\mods-ci\lock` job
   holds the machine (one heavy job at a time).
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
the `cd-ci` account, `G:\ci`, `G:\mods-ci` (read its `lock\` only).
