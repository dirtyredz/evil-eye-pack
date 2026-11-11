# Architecture

## Consolidation evidence

Library closure keeps candidate definitions and proposed physical exclusions in
`analysis/library_closure/targets.cjs`. Every pin is hash checked before recursive
archive traversal, including excluded roots. Reports retain archive SHA-256, provider
provenance, required/optional edges and conservative constant-pool references. Missing
inputs, malformed metadata and ambiguous target providers fail closed. A clear closure
is only dependency evidence, not behavioral replacement acceptance.

`analysis/consolidation/run.mjs` reads a manifest-backed historical world snapshot,
verifies source and copy before and after inspection, and writes only a new job report.
The generic world-trial inventory visitor supplies whole NBT documents from all region,
entity, `.dat` and structure `.nbt` files. Candidate interpretation stays in
`wave7_evidence.cjs`: eleven mounted-storage IDs, Polymorph selections and diagonal
references versus actual packed-palette counts. Equal payloads retain every owning
location; they are not merged as physical holdings. Compacting views are never summed.
Raw NBT remains byte-exact in the read-only snapshot; JSON is a diagnostic projection.
Unknown world files and unknown candidate storage IDs prevent complete evidence.

## Client mixin audit

`tools/testing/client_mixin/run.cjs` stages an independent CLIENT classpath and the exact pack pins,
then adds an unshipped ModLauncher launch service derived from NeoForge's production client
handler. The custom launch target selects the dummy early-window provider and replaces
Minecraft's main method with target verification. Sodium's adapter discovery still runs;
cached native libraries are required, but no game window or OpenGL context is created by the
audit entry point.

Mixin prepares configurations with the production mod set, CLIENT side, plugins, access
transformers and coremods. The probe enumerates the selected configurations' target sets,
loads each target without static initialization and reflects its constructors to force
JVM verification (`-Xverify:all`). It checks unhandled targets after the sweep. The small
reflection adapter into Mixin's processor is specific to the locked Mixin/NeoForge versions;
an API change fails the audit instead of silently reducing coverage. This verifies transformed
classes, not client rendering, mod construction, resource reload or gameplay. Constructor
reflection verifies all bytecode without resolving unrelated optional method-signature types.
A real JVM fixture checks invalid method bytecode even in a class with no constructors,
valid bytecode, missing targets, absent optional method types and no static initialization.

The Node supervisor requires a nonempty completed CLIENT report and zero process/verifier/
mixin errors. It compares missing and unhandled findings with `allowlist.json` by exact
mod/config/mixin/target fields; each reviewed match has a reason, while any changed or new
finding fails. Accepted cosmetic behavior loss is separately tagged `known-minor` with a
Docket id. Failed transformations and incomplete evidence cannot be allow-listed.
Timeout or absent completion is incomplete evidence. Inputs are read-only; all libraries,
mods, configs, logs and compiler outputs are copied into a new artifact run. The host guard
waits for the Minecraft JVM slot and the process scope stops owned children.

## World conversion trials

`tools/testing/world_trial/run.cjs` confines outputs to an artifact job. Copy guards reject protected
instances, overlapping paths and symlinks/junctions in ancestors or descendants. Snapshots
use independent file copies, SHA-256 manifests and read-only file attributes. The source and
snapshot are verified again before and after each boot; neither is booted.

The offline inventory decodes all current region/entity files and `.dat` saved data, including
unloaded chunks. It retains full entity, block-entity, player and mod saved data alongside item
counts, block palette quantities, biome references and chunk terrain digests. Parse errors
invalidate input. Comparisons conservatively flag unexplained differences as LOSS; a raw
NBT-to-component representation change still needs domain review.

`boot.cjs` reuses the offline server preparer, process scope, idle-host guard and smoke
supervisor. Its private caches contain hash-verified pinned jars and copied loader libraries.
Only the working server gets `probe/capture.js`: live registries, one existing forced chunk
at a time, bounded entity-ticking readiness, save, stop, then a separately recorded restart.
Saved citizen chunks are additionally held for 400 ticks before the normal sweep; a separate token-bound colony record reports native bindings and ticking readiness, including unsupported observations honestly. Portable Dank stacks resolve their real frequency through DankItem.getInventoryFrom and retain live slot totals in player evidence.
Owner worlds never enter the ordinary generated-world caches. A complete probe and clean
shutdown establish coverage, not preservation; semantic and log review remains mandatory.

## Mod map

`scripts/mod-map/build.ps1` wraps `tools/analysis/mod_map/build.mjs` with the standard
owner log contract; `run.cjs` orchestrates the pipeline below and owns artifact
placement, input identity checks and saved-evidence replay.

- `inventory/` — `inventory.cjs` resolves each `.pw.toml` pin through
  `packwiz/pinned_jar.cjs` (shared with offline server preparation), reads Forge and
  NeoForge metadata through `data_io/mod_metadata.cjs` (the shared
  `mods.toml`/`neoforge.mods.toml` reader; metafiles go through `pack_index`
  `readTable`), treats a custom `modLoader` as a
  dependency, and traverses declared jar-in-jar metadata. Wrapper jars whose only
  Forge metadata is in their sole embedded archive remain the physical removal
  unit, and physical multi-mod jars stay indivisible; duplicate
  external/embedded mod IDs keep provider provenance and one
  timing attribution.
- `model/` — one job per module: `graph.cjs` connects mandatory mod-ID
  dependencies to physical jars; `classify.cjs` gives each mod a kind with
  evidence and owns the one `isLibrary`; `cost.cjs` sums measured TRACE time
  per unique mod ID; `families.cjs` builds families in three steps (root
  selection, content membership, library ownership); `categories.cjs` places
  each family and standalone mod through `categories.json`, with an explicit
  Other / Uncategorised fallback and per-category de-duplicated timing.
  `overrides.json` holds reasoned kind/family corrections, undeclared
  dependencies and pack-wide fixes.
- `capture/` — `capture.cjs` prepares the disposable server through
  `tools/testing/server_smoke/runtime/offline_server.cjs` with the `ordinary` world profile, waits on
  `tools/testing/server_smoke/process/host_wait.cjs`, reuses pack-test's cached-world copy and
  registry collector and server-smoke's JVM supervision. Only that server gets a
  narrow Forge TRACE logger and the registry snapshot callback. `timing.cjs`
  pairs boundaries before the server `DONE_RE` marker.
- `page/` — `render` is a pure view over finished data (`classifications`,
  `categories` and the family model); it never classifies or categorizes.
  `view.cjs` derives ranking, family trees and cards, `html.cjs` builds escaped
  fragments (compact one-line rows, used-by/needs badges), and `document.cjs`
  is the shell embedding `page.css` and `page.js`.

No installed jar, input cache or instance is changed. [Development](development.md#mod-map)
covers commands and [Gotchas](GOTCHAS.md#mod-map-timing) defines the timing limits.

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

`tools/testing/showcase/check.cjs` discovers matching checks and sequences them in one
dedicated server. `tools/testing/server_smoke/runtime/offline_server.cjs` validates pinned cached
bytes, applies the flat `showcase` profile and reuses pack-test server-copy/evidence
modules; server-smoke also owns watchdog and shutdown.
The injected harness sequences checks and records lifecycle/completion;
`helpers.js` owns fixture access and assertions. Domain checks live in
`checks/<section>.js`; `command_forms.js` runs once afterward against all registry
plans and their shared layout, independently of the selected domain checks. Tests never ship in pack instances.
Commands, layout, coverage and extension recipe: [showcases](showcases.md).

## Automated pack test

`tools/testing/pack_test/run.cjs` drives a server-only acceptance run from Valhalla, normally
booting on ANU. Commands, options and artifact locations are in
[development](development.md); module ownership is in [STRUCTURE](../STRUCTURE.md).
The [EMI architecture](emi.md) covers the separate client subsystem.

### Persistent staging and the ANU world server

`tools/server_stage/stage.cjs` (`ensureStage`) is the one neutral builder of a persistent server stage (loader base
libraries plus an incremental `packwiz -s server` install, stamped with the runtime). The pack test reaches it
through `session/prepare.cjs` and syncs it to ANU; the world server uses it directly. The world server is a
separate, long-lived deployment (not a test): `scripts/server/anu-world-server.ps1` on Valhalla routes actions over
ssh/scp to `server-ctl.ps1` on ANU (config, detached JVM, RCON stop, backup, world manifest), stages the pack with
`tools/world_server/stage-world-server.cjs` and talks to the server with `tools/world_server/mc-net.cjs`
(ping/RCON). Operations and traps: [development](development.md), [GOTCHAS](GOTCHAS.md).

`server_stage/mod-set.cjs` owns the metadata-only both/server jar inventory and staged-byte validation.
The world-server stager uses it after `ensureStage`; Deploy publishes the verified stage's jar names
and pins as `ctl/deployed-mods.json` only after successful extraction/configuration. The fast hash gate
calls `world_server/check-parity.cjs`, a bounded read-only SSH comparison with that last deployment
receipt (explicit skip when unavailable). It neither stages nor installs nor ships controller code.
The controller dot-sources its shipped sibling `server-process.ps1` and dispatches Start/Stop/Status
to callable functions returning exit codes; only the entry point exits PowerShell. OS cmdlets and RCON
remain replaceable at that boundary. The process module detects elevated JVMs from a Limited token through both listeners on one Java PID,
refuses ambiguous identities, and serializes starts with an exclusive file handle. Stop preserves
PID/creation-time identity across listener shutdown; forced kills additionally require the marker.
On Valhalla, `anu-transport-lib.ps1` owns SSH queries (stdout result and checked exit code), while
`owner-run.ps1` owns both streamed and captured native execution and the PowerShell 5.1 stderr workaround.

1. **Verify and stage on Valhalla.** Create an artifact run directory and record the
   checkout identity, pack/index hashes, seed, probe token and the runtime descriptor
   (`tools/testing/server_smoke/runtime/runtime.cjs`: loader, versions, Java major, id from `pack.toml`).
   Verify the hash chain and the runtime's Java, take the local stage lock, then
   incrementally install the server-side pack over the cached per-runtime loader base
   into that runtime's stage (stamped `runtime.json`; a mismatched stage is rebuilt). The stage is never booted. Scan its installed resources
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
3. **Sync and launch on ANU.** Manifest-diff tar/scp sync updates the runtime lane's
   staged server (excluding runtime state) and tool code (excluding tests); non-Forge
   runtimes use their own `lanes/<id>` directories under the one shared lease. Once synced, release
   the local stage lock. Upload `job.json` with the input token, lease, runtime descriptor, lane paths, the runtime's Java
   and boot options; start the detached Node agent at BelowNormal. The agent writes
   `status.json` (`running` then `done` or `error`) and uses the same execution path
   as a local run. Valhalla polls status; failures after launch remain failures.
4. **Boot and probe.** Make a per-run server copy, hard-linking mod jars when possible,
   restore a world cached by runtime, seed, profile, jar bytes and world-shaping config
   (refused across runtimes) unless a fresh world was requested,
   and inject KubeJS probes only into that copy. The hidden, offline, loopback-only
   server (its `runtime.json` must match the job's runtime) must reach `Done` and produce a manifest with this run's token.
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
`tools/analysis/dedup/hidden_reasons.json` class and evidence, rather than a generic orphan
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

`tools/analysis/malware_guard/` owns static detection and policy: `metadata.cjs` inventories
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

## Install route, cutover and rollback

Private migration pins: `tools/packwiz/install/local_source.cjs` verifies hash-addressed cache bytes and
creates the temporary loopback installer overlay; `install_local.cjs` is the dedicated trial
prelaunch wrapper. Server smoke and pack-test staging share the same overlay. Machine paths and
Java come from `tools/runtime_env/env.cjs`; the install route reads its `FIXED` view, which ignores
every `SMOKE_*` override, and runs its processes in a `tools/runtime_env/procs.cjs` scope.

The neutral route is `install/install_pack.cjs`: all hash-verified cached artifacts become
ordinary index files in a temporary local pack. The cached installer copies and tracks them without
any URL or server. Original metafile provenance stays attached to prepared entries. After packwiz,
non-preserved plain files that differ are backed up under the run's `.tmp/trial-install-*/drift-backup/`
and restored to pack bytes; backups survive overlay cleanup. Jar entries are never repaired by this
step. Installed artifact hashes are checked before a target's prelaunch is updated.
Three thin targets sit on it: `trial_target.cjs` (only Evil Eye NeoForge Trial),
`stable_target.cjs` (the real Stable instance or a rehearsal copy; `--fresh` first removes every
file the old install tracked) and `local_target.cjs` (Evil Eye Local only). Local creation
(`--create`) copies Stable's `instance.cfg`/`mmc-pack.json` with the name changed and play history
dropped, no saves; the default run installs the main checkout through the same neutral route and sets
a prelaunch that calls `scripts/instances/local-instance.ps1`. Each target guards itself in
`instance_targets.cjs` (`localTarget` accepts only the Local path). `pack_owned_keys.cjs` forces the keys
in `pack-owned-keys.json` into installed configs after each sync, for all targets.

**Guard authority.** `tools/packwiz/install/instance_targets.cjs` alone decides which MultiMC
instance is which. `stableTarget` is an allowlist: the real Stable `.minecraft`, or a path outside
`C:/Users/dirty/MultiMC/instances` (rehearsal copies); Local, Trial, copies of either, and every
other MultiMC instance are refused. `trialTarget` accepts only the Trial path; `assertPinTarget`
keeps private pins out of Stable and Local. PowerShell never re-implements the rules:
`scripts/migration/cutover-lib.ps1` calls the `classify` and `stable` CLI commands.

**Cutover and rollback** (`scripts/migration/cutover.ps1`, `rollback.ps1`, owner-run, dry run by
default). `cutover.ps1 -Execute` refuses on any guard blocker, archives the whole Stable instance
with a SHA-256 manifest, empties `mods/`, rewrites `mmc-pack.json` and the instance Java to
Minecraft 1.21.1 / NeoForge 21.1.265 / Temurin 21, installs through `stable_target.cjs --fresh`
and points Stable's prelaunch at `stable-prelaunch.ps1`, which repeats that install on every
launch. `rollback.ps1` restores the newest `cutover-archive-*`, keeping the NeoForge folder aside.
Both default `-Instance` from `instance_targets.cjs stable` and refuse anything the allowlist
refuses. See [NeoForge migration](neoforge-migration.md).
