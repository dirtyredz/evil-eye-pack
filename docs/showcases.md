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

## Mekanism and Interstellaris sections (NeoForge branch)

`mekanism_machines` (24 × 22 × 6): a creative energy cube (placed full; a command-placed cube starts empty)
and a universal cable along the backs of an enrichment chamber (16 iron ore) and a crusher (16 iron ingots),
both pre-charged with two operations' energy; both make Ender IO iron dust, the dedup survivor. A heat generator with 32 coal stands apart. Fission,
turbines and other multiblocks are not built.

`interstellaris_space` (24 × 22 × 8): titanium, platinum, silver and tungsten ore under their metal blocks (silver uses the Ice and Fire survivor),
four planet ground blocks, and a 3 × 3 iron pad floating four blocks up. In game, run
`/sable assemble area <corner> <corner>` on the pad to watch Sable turn it into a falling physics body.
Rockets, the Fabrication Unit and multiblock machines need a player (research, launch) and are not built.

## Evil Eye equipment panel section (NeoForge branch)

`evileye_equipment` (24 × 22 × 6): labelled pads for the equipment panel that replaced Cosmetic Armor Reworked (press G
or the inventory's Curios button; equipped curios on the left, cosmetic curios on the right; real armour beside the
model, cosmetic armour opposite; the Visibility... button with Show equipment / Show skin). The panel is a client
screen, so the signs tell the owner what to look for; the check confirms the server side. A STORAGE TABS pad covers the Backpack and Ender tabs (Tweaks/Client 0.12.0; carry the item) and the check requires the `evileye_tweaks:equipment_storage` menu type.

## Evil Eye Essentials section (NeoForge branch)

`evileye_essentials` (24 × 22 × 6): labelled pads for the commands that replaced FTB Essentials (homes on a
lodestone, `/back` and `/spawn` on a respawn anchor, teleport requests, warps on crying obsidian, the trash can,
operator commands, kits and names) and a sign pointing at Evil Eye Client's inventory sidebar. Stand on a pad and
try the command on its sign; the sidebar is in the inventory's top-left corner.

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

Requires Node 22, the runtime's Java from `tools/runtime_env/env.cjs`, and a prepared server
cache stamped for the pack's runtime. **No installer/download runs.** Cache defaults to
`artifacts/evil-eye-pack/pack-test/stage/<runtime id>/server`; override with `SHOWCASE_CACHE`
or `--cache <prepared-server-directory>`. Server jars/resource archives must match
current packwiz hashes. Missing/stale inputs fail before boot; client-only jars
are unnecessary. Pack source files come from this checkout. Stable/Local are never written.

```powershell
node tools/packwiz/rehash.cjs
node tools/packwiz/verify_hashes.cjs
node --test tools/testing/showcase/tests/*.cjs
node tools/testing/showcase/check.cjs contraption_storage
# Every registered section, sequentially in one boot:
node tools/testing/showcase/check.cjs --all
# Optional same-cache baseline and warning/error comparison:
node tools/testing/showcase/check.cjs --baseline-ref main --out <baseline-directory>
node tools/testing/showcase/check.cjs contraption_storage --out <new-directory> --compare <baseline-directory>
```

Every boot also runs `flat_world.js` once (FlatWorldFix vs Terralith: four far Superflat columns keep the
default layers, plains and one height). The shared `command_forms.js` check runs once after the selected section checks,
building and clearing every registered section in a separate row. Its expected
record count and per-section origins come from the registry and `ns.layout`; even
a single-section run exercises the complete command tree. `helpers.js` supplies
`makeHelpers` for both this row and the section fixtures.

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
| `mekanism_machines` | Hostile-terrain build; full plan; creative cube placed full; machine inputs and charge prefilled from block-entity NBT; enrichment chamber and crusher output Ender IO iron dust and never Mekanism dust; ore consumed; heat generator burns coal into stored energy; cube stays full; running rebuild resets contents; clear; exterior shell unchanged (106 assertions, `jobs/2026-10-30-neoforge-phase7/showcase-mek-14`). Cable transport is not asserted: command-placed Mekanism blocks expose no sided energy (dk-1a3141d6) | Whether a player-placed cube powers the cable; machine fronts animate; generator flames |
| `interstellaris_space` | Hostile-terrain build; full plan; the Moon, Mars, Venus, Enceladus and Io dimensions load; Moon and Mars generate solid ground (Moon: lunar regolith) and receive a teleported traveller; `/sable assemble area` captures the pad into exactly one sub-level that stays alive for 100 ticks of server physics; rebuild; clear; exterior shell unchanged (128 assertions, `showcase-is-8`) | The pad falling (Sable's position selectors matched nothing headless), ore/metal textures, rockets and travel |
| `evileye_essentials` | Hostile-terrain build; full plan; exterior shell; every Essentials command registered and no FTB command tree; `/rtp` off; the FTB import command runs; a fake player sets a home, uses `/home` and `/back`, hits the 60 s cooldown, deletes the home; `/setwarp` refused below level 2 and allowed for an operator, `/warp`, `/delwarp`; `/trashcan` runs (a fake player cannot open its menu); rebuild; clear (134 assertions; `--all`-style boot total 579/579 with flat-world and command forms, `jobs/2026-11-01-evileye-essentials-wave5/showcase-ess-3`) | The inventory sidebar (buttons, icons, tooltips, operator-only visibility); real teleports and chat messages; the trash can screen |
| `evileye_equipment` | Hostile-terrain build; full plan; exterior shell; the server registers the `evileye_tweaks:equipment` menu type; Evil Eye Tweaks loaded and Cosmetic Armor Reworked not loaded; rebuild; clear (VM-tested; not yet run in a boot) | The panel screen itself (layout, cosmetic slots, Visibility editor), cosmetic armour rendering on players |
| `contraption_storage` | First build on hostile terrain (hill, tree, water, floor hole, chest, fence) with an unnamed mob and item removed, a named mob refused without any change, a mob outside untouched and the exterior shell identical (shared `tools/testing/showcase/terrain.js`); all blocks/states/prefills and complete floor/air volume; quantity flag; one glue and no dropped items; exterior shell; all six sided + unsided drawer handlers; idle motor; lever start/stop; five-block/three-inventory assembly; PSI docking; exact insert/extract per inventory; compacting ratios; disassembly preservation; automatic input/output hopper circuit; rotation; idle/active rebuild; clear | Drawer icons/counts at 8/24/48 blocks and front/back views; moving fronts; opening moving drawer/chest menus |

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
   Put inventories in `p.fills`. Static sections need no rig. For Create, set
   `p.rig = ns.createContraption()`, then populate `p.rig.glue` (AABBs),
   `p.rig.motors` (`{x,y,z,speed,lever:[x,y,z]}`) and `p.rig.bearings`
   (coordinates). Keep placements, glue and the **full swept payload** inside
   the plot. Limit volume to 32,768 cells including the floor and rates to 16 RPM.
   The floor is `ns.FLOOR`. New mechanics belong in `rigs/<type>.js` (priority
   between 30 and 20), registered in `ns.rigs`; keep the descriptor JSON-only.
   Hooks are `validate(descriptor, point, seen, integer)`,
   `teardown(descriptor, level, pos)`, `afterTeardown(descriptor, level, box)`,
   `placed(descriptor, level, pos, block)`, `finish(descriptor, level, origin)`
   and `tick(descriptor, level, origin)`. Optional `ownEntity(type)` and
   `preflight(sweep, box, refuse)` apply to entity sweeps for all plots; preflight
   must only read and must throw before any mutation. The complete descriptor
   persists in the plot record; ticks must never reconstruct a section plan.
3. Add `tools/testing/showcase/checks/<name>.js`, priority -10, registering
   `global.evilEyeShowcaseChecks.<name> = function (h) { ... }`; call
   `global.evilEyeShowcaseTerrain(h)` first for the shared hostile-terrain check. Use `h.invoke()`
   for the real command, `h.check` for assertions, `h.later` for bounded tick
   waits and `h.done()` on completion. The harness owns setup/failure/sequencing;
   do not add boot processes or loaded hooks. `h.verifyPlan`, `h.shell`,
   `h.handler` and `h.amount` supply shared fixture checks from `helpers.js`.
   Section checks assert only their own plan. Do not duplicate permissions or
   command-form checks: `command_forms.js` runs once per boot across the registry,
   verifying bare/named builds, list, refusals and clear at the row origins.
4. Add Node VM tests of the production layout/registry under `tools/testing/showcase/tests/`,
   including failures/negative controls. Discovery requires a matching headless
   check for each shipped section. Neither command nor runner needs another switch.
5. Update this coverage table and [FEATURES](FEATURES.md), plus architecture/gotchas
   if contracts change. Rehash, run the fast gate and the section headlessly,
   inspect every assertion and log comparison, then hand off client-only checks.

NeoForge fixture details (2026-10-30): exact storage accounting uses temporary redstone power
to pause both hoppers; setting `enabled=false` alone is undone by neighbour updates. The next
rebuild restores automatic flow. Planet travel waits at most 20 ticks for destination entity
tracking after a successful teleport. Full `--all` acceptance: 1277/1277 assertions in
`jobs/2026-10-30-alexsmobs-pin/showcase-all-arrival`; diamond investigation: dk-54d65c18.

Ice and Fire integration acceptance (2026-10-30): `jobs/2026-10-30-iaf-integration/showcase-all-ready`
passes 1279/1279 (storage 657, space 130, Mekanism 106, flat-world 2, command forms 384).
The space fixture waits for each destination to be entity-ticking before teleporting, then
still checks exactly one traveller arrives. The first integration run had a successful teleport
and the stand saved at moon (8.5, 93, 8.5), but its immediate destination query timed out.
The readiness check adds two assertions, with bounded failure rather than skipped checks.
