# Architecture

## Mod map

`scripts/mod-map/build.ps1` wraps `tools/mod_map/build.mjs` with the standard
owner log contract. `inventory.cjs` validates `.pw.toml` pins, reads Forge TOML
through `toml.cjs`, treats a custom `modLoader` as a dependency, and traverses
declared jar-in-jar metadata. Wrapper jars whose only Forge metadata is in their
sole embedded archive remain the physical removal unit. `model.cjs` builds
the mandatory graph, detects content-family roots, follows nested add-ons into
each applicable family, and separates family-exclusive from shared libraries.
Player-facing suites whose metadata does not encode a base relationship use
reasoned entries in `overrides.json`; the same hand-kept file records confirmed
undeclared dependencies and pack-wide fixes. Physical multi-mod jars remain indivisible;
duplicate external/embedded mod IDs retain provider provenance and one timing attribution.
`categories.cjs` places each family and standalone mod through the checked-in
`categories.json` map, with an explicit Other / Uncategorised fallback. Category
timing de-duplicates member and library nodes within the category; the existing
family tree remains responsible for showing libraries beneath each user.

`capture.cjs` reuses showcase's offline preparer and idle-host guard, pack-test's
cached-world copy and registry collector, and server-smoke's JVM supervision and
shutdown. Only the disposable server gets a narrow Forge TRACE logger and the
registry snapshot callback. `timing.cjs` pairs boundaries before `Done`;
`page.cjs` renders compact one-line mod rows with first-sentence descriptions,
used-by/needs badges and inline styles/controls. `run.cjs` owns artifact
placement, input identity checks and saved-evidence replay. No installed jar,
input cache or instance is changed. [Development](development.md#mod-map) covers
commands and [Gotchas](GOTCHAS.md#mod-map-timing) defines the timing limits.

## Showcases

`kubejs/server_scripts/showcase/` separates pure bounded plans/registry/layout
(priority 30), rig implementations (25), content sections (20), plot records (18),
entity policy (15), staged construction (10), record-only control dispatch (5),
and permission-level-2 command registration (0). Priorities order files across
folders. Sections return descriptors, never write worlds. The builder preflights
before mutations, tears down every overlapping plot with its own recorded rig,
reserves the plot, then runs place/finish stages.
`plots.js` owns persistence and overlap; the shared floor is `ns.FLOOR`.

A section may attach a JSON-only `p.rig` descriptor. Generic code dispatches its
validation and lifecycle hooks to `rigs/`; Create owns glue, motors, bearings and
server-thread collision preparation (Create/Canary constraint; see GOTCHAS).
The full rig persists in the record, so controls resume after reload/restart or
section removal without consulting factories or force-loading chunks. The Create
adapter handles old motor-only records by reading existing glue when starting;
a rebuild stores the complete descriptor. Missing rig implementations skip ticks.

`tools/showcase/check.cjs` discovers matching checks and sequences them in one
dedicated server. Offline preparation validates pinned cached bytes and reuses
pack-test server-copy/evidence modules; server-smoke owns watchdog and shutdown.
The injected harness sequences checks and records lifecycle/completion;
`helpers.js` owns fixture access and assertions. Domain checks live in
`checks/<section>.js`; `command_forms.js` runs once afterward against all registry
plans and their shared layout, independently of the selected domain checks. Tests never ship in pack instances.
Commands, layout, coverage and extension recipe: [showcases](showcases.md).

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
   acquisition, machine, crafting, dedup, malware and log checks over saved evidence.
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

### Malware guard

`pack_test/session/security.cjs` writes `evidence/malware.json` on Valhalla before choosing a
boot target. It scans installed `mods/`, resource packs and shader packs, recursively
visiting every jar/zip entry (including jars outside jarjar paths), and gates the
checkout's metadata. `--instance <.minecraft>` adds a read-only drift inventory.
The instance scan covers these three content directories; launcher libraries and
world saves are outside that inventory. A direct directory argument scans its tree.

`tools/malware_guard/` owns static detection and policy: `metadata.cjs` inventories
expected paths, `drift.cjs` compares installed content, `gate.cjs` checks sources,
and `scanning/` compiles `data/signatures.json` and scans bytes. Shared `data_io` owns ZIP
decoding and jar walking, including optional raw bytes and bounded entry reads;
existing consumers retain text traversal. Each visited file has a SHA-256. An
archive finding binds the outer archive hash to its exact entry path and signature;
folder-file findings bind the file hash. Unreadable archives, symlinks and exceeded
limits invalidate the scan rather than silently passing.

Detection returns raw reports with explicit `kind` (`scan`, `drift`, `gate`), without
loading approvals. The CLI applies approvals once before output and exit; the
evidence collector saves raw reports without constructing a policy.

Offline analysis maps saved findings through the current hash/finding allowlist
and owner-added registry through `policy.cjs` shared approval keys and
`applyApprovals` once in `checks/security/malware.cjs`. Legacy schema-1 reports
without a kind use their named evidence slot; saved approvals are discarded so
revoked approvals cannot survive re-analysis. Unknown report kinds are rejected. Reviewed matches are info; fresh matches are failures.
Missing security evidence makes a historical run incomplete: never substitute a
current instance implicitly. The guard reports static evidence, not runtime safety
or proof of a data flow; URL/class-loader and Base64/class-loader co-occurrence
deliberately needs review. It does not quarantine files or replace the boot checks.

`status` is a separate opt-in Modrinth HTTP client with a caller-selected cache,
TTL, timeouts and injected transport for tests. Offline staging and analysis never
import or invoke it. Failed requests say `not checked`; unavailable versions are
distinguished from archived projects. Known-bad IDs/hashes are used when present;
the initial owner-supplied list has slugs/names only and records that limitation.
