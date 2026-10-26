# Showcases

Showcases are repeatable, labelled fixtures for testing mod interactions. The same
production command builds the operator's display and the disposable headless test.
A server check cannot verify client rendering or menus.

## Commands and placement

All commands require permission level 2 (operator):

| Command | Effect |
|---|---|
| `/evileye showcase` | Build **every** section where you stand, side by side (8 blocks apart, along world east) |
| `/evileye showcase list` | List registered sections |
| `/evileye showcase contraption_storage` | Build or reset the storage section |
| `/evileye showcase clear contraption_storage` | Tear down the section at the same origin |
| `/evileye showcase clear` | Tear down every section built by the bare command |

The bare command mirrors `/roundwood showcase`. Names are case-insensitive, extra spaces
are tolerated, and the argument tab-completes (`list`, `clear`, section names). An unknown
name or extra word gives `Showcase: unknown showcase "x". Available: ...` instead of a raw
Brigadier error (the argument is one greedy string parsed by the script). Sections are
preflighted and built in name order; a refusal keeps earlier sections built. The row
spans all sections, so repeat from the same position and direction to rebuild or clear.

The plot starts four blocks ahead of the source, centred across the other axis.
The floor row sits at the block under your feet, and the plot extends ahead of and
beside you for your facing. The layout itself is fixed to world east/up/south, with
a north entrance and north-facing signs: Create bearings, glue boxes and sign
rotations are authored in absolute coordinates, so rotating a contraption plot is
not practical. The success message prints its origin and size. Repeat from the **same position and
direction** to rebuild or clear. For a fixed origin `(160,240,0)`:

```text
/execute positioned 172 240 -4 rotated 0 0 run evileye showcase contraption_storage
/execute positioned 172 240 -4 rotated 0 0 run evileye showcase clear contraption_storage
```

Use a disposable creative test area. **The showcase makes its own plot** wherever you
stand, first time: it needs no flat ground and no empty space. Every position in the
box becomes air except the floor row (relative y=-1), which becomes stone bricks;
hills, trees, water, holes and block entities inside are replaced. Writes use flags
50 (client update, no neighbour updates, no drops), so nothing outside the box is
disturbed. Preflight refuses, naming the fix, only for real impossibilities: build
height, the world border, chunks not fully loaded, an unknown block/item in the
plan, or a **protected entity** inside the box (a player, a tamed/owned animal, or
anything with a custom name). All other entities (mobs, items, frames, stale glue)
are discarded and listed in the success message (`removed N mobs/items (...)`).
Another showcase overlapping the plot is replaced.
Plot ownership persists in server data so repeating stops/disassembles the rig.
Rebuilding **discards its contents and later block edits inside it**. Clear leaves
a stone-brick floor; it does not restore terrain, and refuses where nothing was built.
A partial build retains its reservation for clear/retry.

## Storage section layout

The plot is **24 east × 53 south × 8 high**, plus its floor. Pins: Create: Compatible
Storage 2.14.0, Create: Storage Drawers Compat 1.1.0, Storage Drawers 12.15.1,
and Create 6.0.8.

- Gold entrance marks align with columns x=2/7/12/17. Rows at z=8/24/48 repeat
  prefilled one-, two-, four-slot and iron compacting drawers, with quantity display
  enabled. Sample signs are two cells east, leaving one cell clear.
- Between the first two rows, a motor at `(8,0,16)` starts at **0 RPM**. The labelled
  lever at `(7,1,16)` enables **2 RPM**. A shaft and upward bearing carry a glued
  arm: standard drawer, compacting drawer, iron chest and east-facing moving PSI.
  Steps lead to a viewing platform north of the arm, outside its swept volume.
- The west-facing stationary PSI at `(14,3,16)` docks across a one-block gap.
  An input chest above feeds diamonds, iron and emeralds through a hopper;
  another hopper extracts into the chest below. Transfers pause rotation.
  The lever stops rotation; rebuild/clear performs teardown.

The finite supply is deliberately drainable. Inspect the mounted fronts while
docked; rerun to replenish after the circuit empties the inventories.

## Roundwood native showcase

Roundwood 0.13.3 owns `/roundwood showcase`; it is not an `/evileye` section.
Run it as an operator **player** in a disposable area. It builds a labelled
90 × 8 × 28 volume, including its floor/border, three blocks ahead and centred
across the player's facing. It clears that volume on every invocation, including
existing builds; it does not use the pack's plot reservations or occupied checks.
The whole area must be loaded and within the world border/build height.

The display includes doors, ordinary/keyhole archways, window profiles and Cross
Beams, trim and material samples. Inspect archway openings and Cross Beam styling
in game; headless checks cannot establish their rendering. Native commands need
a player source, so headless probes use a Forge fake player instead of a bare
`execute positioned` console source. Keep this display away from pack showcases.

## Run the headless check

Requires Node 22, Java/Forge from `tools/server_smoke/env.cjs`, and a prepared server
cache. **No installer/download runs.** Cache defaults to
`artifacts/evil-eye-pack/pack-test/stage/server`; override with `SHOWCASE_CACHE`
or `--cache <prepared-server-directory>`. Server jars/resource archives must match
current packwiz hashes. Missing/stale inputs fail before boot; client-only jars
are unnecessary. Pack source files come from this checkout. Stable/Local are never written.

```powershell
node tools/packwiz/rehash.cjs
node tools/packwiz/verify_hashes.cjs
node --test tools/showcase/tests/*.cjs
node tools/showcase/check.cjs contraption_storage
# Every registered section, sequentially in one boot:
node tools/showcase/check.cjs --all
# Optional same-cache baseline and warning/error comparison:
node tools/showcase/check.cjs --baseline-ref main --out <baseline-directory>
node tools/showcase/check.cjs contraption_storage --out <new-directory> --compare <baseline-directory>
```

The runner takes a showcase lock and checks Windows' Minecraft JVM inventory,
waiting up to 45 minutes for another game/server. It reuses the server-smoke
watchdog/process scope and always stops its server. The dedicated server is
loopback-only, offline, port 25609, with a fresh flat world. Sections run at
x=`160 + index*128`, y=240, z=0; keep fixtures within that spacing.

`--out` must name a new directory. It retains the disposable server, `inputs.json`
(pins), `report.json` (individual assertions), and `evidence/` logs. Exit 0 means
complete/pass, 1 failed assertions/boot/log checks, 2 invalid setup/execution.
After a failed assertion, later checks are **unrun**, never implicitly passed.
The baseline is a local `git archive`, not a checkout switch or fetch. New
normalized warning/error groups fail comparison; run paths and Java object
identities are stripped before comparison, and counts remain for inspection.
Without `--compare`, no main comparison is claimed. Script errors and missing
completion always fail.

| Section | Headless assertions | Owner's eyes |
|---|---|---|
| `contraption_storage` | Permissions/list; first build on hostile terrain (hill, tree, water, floor hole, chest, fence) with an unnamed mob and item removed, a named mob refused without any change, a mob outside untouched and the exterior shell identical (shared `tools/showcase/terrain.js`); all blocks/states/prefills and complete floor/air volume; quantity flag; one glue and no dropped items; exterior shell; all six sided + unsided drawer handlers; idle motor; lever start/stop; five-block/three-inventory assembly; PSI docking; exact insert/extract per inventory; compacting ratios; disassembly preservation; automatic input/output hopper circuit; rotation; idle/active rebuild; clear | Drawer icons/counts at 8/24/48 blocks and front/back views; moving fronts; opening moving drawer/chest menus |

The exterior snapshot covers all faces immediately outside the volume, including
block-entity data, before build and after motion/clear. Plan tests also reject
out-of-bounds descriptors. This is bounded fixture evidence, not a whole-world
scan or a guarantee against unrelated world ticks. Drill/harvester collection
belongs in a future section.

## Add a section and its check

1. Add **one production file** at `kubejs/server_scripts/showcase/sections/<name>.js`,
   priority 20. In an IIFE, call `global.evilEyeShowcase.register('<name>', factory)`.
   Use lowercase letters/digits/underscores; list/clear are reserved. Return a
   fresh `ns.plan(width, depth, height)`. No world access in section files.
2. Use `p.block`, `p.sample` (prefill + sign two cells east) and `p.label` (headings).
   Put inventories in `p.fills`, glue AABBs in `p.glue`, motors in `p.motors`
   (`{x,y,z,speed,lever:[x,y,z]}`), and bearing coordinates in `p.bearings`.
   Keep placements, glue and the **full swept payload** inside the plot. Limit
   volume to 32,768 cells including the floor and motor rates to 16 RPM.
   New world-writing primitives belong in the shared builder/controls.
3. Add `tools/showcase/checks/<name>.js`, priority -10, registering
   `global.evilEyeShowcaseChecks.<name> = function (h) { ... }`; call
   `global.evilEyeShowcaseTerrain(h)` first for the shared hostile-terrain check. Use `h.invoke()`
   for the real command, `h.check` for assertions, `h.later` for bounded tick
   waits and `h.done()` on completion. The harness owns setup/failure/sequencing;
   do not add boot processes or loaded hooks. `h.verifyPlan`, `h.shell`,
   `h.handler` and `h.amount` supply shared fixture checks.
4. Add Node VM tests of the production layout/registry under `tools/showcase/tests/`,
   including failures/negative controls. Discovery requires a matching headless
   check for each shipped section. Neither command nor runner needs another switch.
5. Update this coverage table and [FEATURES](FEATURES.md), plus architecture/gotchas
   if contracts change. Rehash, run the fast gate and the section headlessly,
   inspect every assertion and log comparison, then hand off client-only checks.
