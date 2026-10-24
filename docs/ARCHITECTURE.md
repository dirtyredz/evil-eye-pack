# Architecture

## Automated pack test

`tools/pack_test/run.cjs` drives a server-only acceptance run from Valhalla, normally
booting on ANU. Commands, options and artifact locations are in
[development](development.md); module ownership is in [STRUCTURE](../STRUCTURE.md).
The [EMI architecture](emi.md) covers the separate client subsystem.

1. **Verify and stage on Valhalla.** Create an artifact run directory and record the
   checkout identity, pack/index hashes, seed and probe token. Verify the hash chain,
   take the local stage lock, then incrementally install the server-side pack over
   the cached Forge base. The stage is never booted. Scan its installed resources
   and shipped configs into `evidence/resources.json`, and copy the pack policies
   into `evidence/pack-config/` before choosing the boot target.
2. **Choose local or ANU.** `--local` goes straight to local execution. Otherwise,
   try SSH aliases `anu`, then `anu-byname`, ensure the remote tools are provisioned,
   and attempt the pack-test lease once. Unreachable SSH, a busy lease or a failed
   capacity decision falls back locally without waiting. Capacity is checked before
   sync and again before launch: no live neighbour job means alone; sharing requires
   readable load data, at least 8 GB free RAM and mean CPU below 50% by default.
   The neighbour's lock and queue are read only. Provisioning, sync and other thrown
   setup errors invalidate the run; they are not blanket fallback conditions.
3. **Sync and launch on ANU.** Manifest-diff tar/scp sync updates the staged server
   (excluding runtime state) and tool code (excluding tests). Once synced, release
   the local stage lock. Upload `job.json` with the input token, lease, runtime paths
   and boot options; start the detached Node agent at BelowNormal. The agent writes
   `status.json` (`running` then `done` or `error`) and uses the same execution path
   as a local run. Valhalla polls status; failures after launch remain failures.
4. **Boot and probe.** Make a per-run server copy, hard-linking mod jars when possible,
   restore a world cached by mod set and seed unless a fresh world was requested,
   and inject KubeJS probes only into that copy. The hidden, offline, loopback-only
   Forge server must reach `Done` and produce a manifest with this run's token.
   The probe writes live registries, final tags, recipes and real FakePlayer craft
   results, with the manifest last. The supervisor bounds boot/probe time and stops
   its processes; evidence collection includes payloads, logs, crash reports and
   any stall thread dump. Successful fresh worlds can be cached; the disposable
   server is normally removed.
5. **Return evidence and analyse on Valhalla.** For ANU, pull the evidence and agent
   records home, then remove the remote run directory. A shared ANU boot classified
   as CPU-starved gets exactly one local retry, replacing its probe/log/crash evidence
   and retaining a shared-attempt note. Alone runs and the retry have no further retry.
   Save `run.json`, validate the probe contract and run the recipe, reference,
   acquisition, machine, crafting, dedup and log checks over saved evidence.
   Compare findings with `data/baseline.json` as new, known or resolved; write
   `report.json`, `summary.txt` and, for new findings, `baseline-candidate.json`.
   The committed baseline is never updated automatically. Exit 0 means no new
   findings, 1 means new findings, and 2 means an invalid run (including incomplete
   evidence, crash, setup or cleanup failure); baselines cannot absorb exit 2.
   Offline analysis skips staging and booting and uses saved evidence with the
   currently loaded checks, policy and baseline.

Acquisition exclusions for saved `dedup.json` `hiddenOnly` ids use the current
`tools/dedup/hidden_reasons.json` class and evidence, rather than a generic orphan
label. Missing reasons fail analysis; registry entries alone do not exclude items.
`report.json` retains the matched item-to-reason map at
`sections.acquisition.exclusions`; summary counts and finding identities are unchanged.

### ANU lease and cleanup boundary

The launcher acquires an immutable `{ runId, claimId }` lease, passed in `job.json`.
The lock directory's `owner.json` stores the run as `owner`, the unique acquisition
`claimId`, and heartbeat timestamp `at`. The agent verifies that exact pair at
startup and refreshes it atomically every 30 seconds; it never adopts another claim.
A missing, unreadable or replaced lease is terminal: stop owned children, report an
error and exit 2. Release also requires both identity fields, so the old agent cannot
release a replacement claim, even for the same run id.

Only the launcher takes over stale locks: a readable heartbeat must be at least
10 minutes old; a missing or malformed owner stays busy until the directory itself
is that old. The agent refreshes or releases its own lease, never reacquires it.
Before an agent starts, the launcher releases its lease on exit; afterwards the agent
owns release. Interrupt cleanup targets the remote agent only while its callback is
armed and its PID's command line matches both the agent script and this job file,
protecting against PID reuse. Local process scopes likewise own their children.

This is a server data/behaviour check, not a client rendering or interaction test.
Raw-resource scans approximate pack precedence; live state and logs supply runtime
evidence. Trades, Java-coded drops and other invisible acquisition mechanisms need
reviewed exclusions or reasoned baseline entries.

### Shared jar traversal

Dedup and resource scanning use `tools/data_io/walk.cjs`. Dedup keeps top-level-only traversal, strict JSON parsing, item models and loot modifiers; pack-test retains nested jarjar traversal, lenient JSON and fluid tags. Selection, merging and provenance remain caller-owned. ANU tool sync includes the shared data_io and dedup modules.
