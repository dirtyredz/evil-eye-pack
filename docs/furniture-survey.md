# Furniture and wood-variant survey

2026-11-02 · Docket `dk-90f013de` · findings only; no content or configuration changes.

**Keep the installed content while the owner selects styles, then try reversible EMI
curation of selected duplicates.** The largest static opportunities are Dramatic Doors,
Macaw's BOP expansion, Handcrafted and Cluttered. They are not automatically the largest
runtime costs. Replacing them with “one block with material properties” is not an
established performance improvement. Roundwood and Domum demonstrate a more specific
alternative: material data in block entities feeding cached chunk models.

## Evidence and limits

The 23 primary physical jars all match this checkout's packwiz pins. Eight adjacent
mods and MineColonies/Structurize/StyleColonies were also inspected. No JVM or client
was launched. Runtime registry totals, state totals, actual EMI master/visible counts,
retained memory, baked quads and startup/bake timing remain **unmeasured**, except for
the explicitly reconstructed Roundwood registrations below.

Job evidence: `C:/Users/dirty/projects/artifacts/evil-eye-pack/jobs/2026-11-02-furniture-survey/`.
The local files are deliberately outside the pack; they contain private world evidence.

| Evidence | Contents |
|---|---|
| `assets.json` | Base commit, pack/index SHA-256, each jar filename/hash, blockstate keys, model parents/loaders, texture dimensions/animation metadata, identical-byte groups, class-reference leads and wood families |
| `class-details.json` | Parsed installed class hierarchy, method signatures, constant-pool references and decoded bytecode instruction offsets for Roundwood, Domum and spark |
| `render-evidence.json` | Per-mod BE inheritance, BER interfaces, renderer-binding references and ticker method hints |
| `context.json`, `resource-overrides.json` | Checkout/Stable config and resource hashes, actual Stable resource-pack order and resource-name collisions |
| `world/source-manifest.json`, `world/snapshot/` | Independent copy of the named pre-cutover archive; source/copy hashes verified before and after analysis |
| `world/inventory.json`, `world-summary.json` | Packed-palette counts; item, BE, entity and saved-data records with provenance; separated item categories and mounted payloads |
| `scripts/` | Throwaway offline analysis scripts; no maintained tool package or new test suite |

Four checkout pins have no same-named jar in Stable: Evil Eye Client, Essentials,
Tweaks and World Migration. This is version/filename drift, not a failed furniture
pin check. No other version was substituted. The jar table describes the checkout's
verified furniture bytes, not proof that a complete matching client was exercised.
Config hashes describe observed files, not defaults guaranteed to be effective in a
future disposable client; saved-world server configs can override pack defaults.

## Metric definitions

- **B**: unique root-jar `assets/*/blockstates/*.json` paths, an asset-derived block
  candidate count. Compatibility assets can be dormant; dynamic registrations can
  lack files. This is not a verified registry total.
- **V/P**: explicit `variants` keys / `multipart` clauses across those files. Neither
  is a count of possible registered states. Wildcards, omitted properties, multipart
  combinations and weighted choices make conversion to a state count unsafe.
- **Models B/I/O**: block / item / other JSON files. **I is the static item/EMI entry
  estimate**, meaning an item-model surface, not a lower bound or upper bound on
  actual entries. Components can multiply entries, aliases can be hidden, and
  inherited/generated item models can avoid files altogether.
- **PNG**: texture files, including GUI/entity/painting resources; not atlas residency.
  `assets.json` also records dimensions and `.png.mcmeta` presence (metadata presence
  is an animation candidate, not verified animation playback).
- **BE hints / BER / T**: classes referencing `BlockEntityType` / classes directly
  implementing `BlockEntityRenderer` / classes referencing `BlockEntityTicker`.
  These are static scan metrics, **not registered type, active renderer or ticking
  instance counts**. Inherited/framework renderers and nested providers need further
  resolution. Zero means no match in the inspected root classes, not certified absence.
- **Placed / saved BE**: actual decoded terrain placements / BE records in the
  archived world, aggregated by owning namespace. Neither includes material donors
  as additional placed furniture. A zero never proves current Stable non-use.

All primary asset rows have high confidence as counts of the pinned bytes; registration
and EMI extrapolations have low confidence. Historical decoded placements have high
confidence within the stated file coverage. Runtime performance remains unknown.

## Ranked opportunities

Rank means priority for owner selection and reversible curation, balancing measured
asset burden against functional differences and conversion cost. It is not an aesthetic
ranking, FPS forecast or removal authorization. Every row inherits the confidence and
unmeasured-runtime qualifications above.

<!-- survey-ranked -->
| Rank | Mod: overlap; unique value | B | V/P | Models B/I/O (I = EMI proxy) | PNG | BE hints/BER/T | Historical placed/BE | Proposed action |
|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Dramatic Doors: openings; short/tall designs | 1929 | 71390/0 | 16679/1941/0 | 5917 | 7/0/0 | 0/0 | Shortlist heights; curate duplicates; dormant compat inflates assets |
| 2 | Macaw BOP: suite-wide shapes; matching species | 2035 | 35971/776 | 6788/2048/0 | 1040 | 1/0/0 | 0/0 | Shortlist woods; preserve sibling dependencies |
| 3 | Handcrafted: seats/storage/trim; detailed domestic shapes | 267 | 60921/0 | 12109/285/0 | 1009 | 9/1/1 | 0/0 | Compare plain furniture; preserve oven/crockery behavior |
| 4 | Cluttered: furniture/props; themed sets and storage | 1012 | 8100/371 | 2071/1001/0 | 1128 | 31/0/0 | 0/0 | Choose themes before hiding; binder hint exists despite zero direct BER interfaces |
| 5 | Macaw Furniture: seats/tables/storage; matching woods | 652 | 7500/0 | 2320/654/0 | 20 | 3/0/0 | 0/0 | First plain furniture curation candidate |
| 6 | Additional Lanterns: lighting; finish range | 736 | 5693/0 | 2831/737/0 | 113 | 0/0/0 | 0/0 | Curate favourite finishes |
| 7 | Macaw Roofs: roof topology/material range | 605 | 18812/0 | 2076/607/0 | 32 | 0/0/0 | 0/0 | Keep shapes; curate materials |
| 8 | Macaw Windows: openings; shutters/blinds/profiles | 328 | 7608/422 | 1561/326/0 | 164 | 0/0/0 | 0/0 | Compare equivalent openings only |
| 9 | Macaw Doors: decorative door designs | 246 | 7676/0 | 1134/260/0 | 702 | 0/0/0 | 0/0 | Compare with Dramatic/Roundwood |
| 10 | Macaw Trapdoors: patterned openings | 179 | 2864/0 | 183/191/0 | 169 | 0/0/0 | 0/0 | Curate patterns |
| 11 | Friendly Furnishings: domestic sets; patterned cabinetry | 300 | 752/0 | 300/302/179 | 373 | 50/0/0 | 0/0 | Owner style shortlist; preserve storage |
| 12 | Create Deco: lighting/structure; industrial detailing | 389 | 5408/831 | 956/403/0 | 589 | 7/0/0 | 0/0 | Keep industrial identity |
| 13 | Macaw Paths: ground surfaces; path shapes | 315 | 2576/0 | 569/315/0 | 146 | 0/0/0 | 0/0 | Curate surface styles |
| 14 | Macaw Stairs: stairs/balconies; custom topology | 224 | 1260/336 | 439/224/0 | 0 | 0/0/0 | 0/0 | Keep useful shapes |
| 15 | Macaw Fences: boundaries; gates/profiles | 180 | 1032/709 | 674/180/0 | 59 | 0/0/0 | 0/0 | Retain Diagonal compatibility context |
| 16 | Macaw Bridges: structures; bridge/pier shapes | 145 | 1893/0 | 588/146/0 | 10 | 0/0/0 | 0/0 | Keep unique geometry |
| 17 | Refurbished Furniture: furniture/storage; powered appliances | 449 | 4897/227 | 2129/475/27 | 548 | 61/15/13 | 0/0 | Keep functions; curate plain decor only |
| 18 | Interiors: seating; upholstery/train interiors | 53 | 1113/0 | 307/53/0 | 23 | 0/0/0 | 0/0 | Keep pending style choice |
| 19 | MultiBeds: beds; layered/custom appearance | 12 | 11/24 | 317/299/0 | 347 | 9/1/0 | 0/0 | Keep; component/custom-model audit before changes |
| 20 | Roundwood: openings/arches/trim; editable materials | 91 | 49/1036 | 168/98/0 | 113 | 29/1/0 | 0/0 | Keep architecture reference and aliases |
| 21 | Domum Ornamentum: structure/decor; material combinations | 100 | 267/1051 | 430/118/0 | 59 | 7/0/0 | 70/68 | Keep; observed historical use and colony context |
| 22 | Macaw Paintings: curated artwork | 0 | 0/0 | 0/0/0 | 90 | 0/0/0 | 0/0 | Keep; painting variants escape the item-model proxy |
| 23 | CozyCafe: cafe interactions; menu/plating behavior | 4 | 36/0 | 5/7/0 | 15 | 9/2/2 | 0/0 | Keep; tiny asset surface |
<!-- /survey-ranked -->

Across the primary jars: **10,251 blockstate files, 65,510 model JSONs, 10,670 item
model files and 12,666 PNGs**. The PNG dimensions sum to about **53.0 MiB at four bytes
per pixel**, before deduplication, atlas packing, mipmaps, animation handling, resource
overrides and driver copies. This is a pixel-volume proxy, not measured GPU memory.
Handcrafted alone contributes 16.37 MiB by that proxy; file count is a poor substitute
for dimensions. The full primary/adjacent/context scan finds 860 identical-PNG hash
groups, with 2,286 extra copies. Those are not all primary furniture and are not a
claim that the engine allocates each copy independently.

Macaw's Furniture has 2,320 block models but only 20 PNGs; Stairs has no own PNGs.
Existing material/parent sharing already prevents a simple “one file, one independent
geometry/texture allocation” interpretation. Macaw BOP models reference sibling
`mcwroofs`, `mcwdoors`, `mcwstairs`, `mcwtrpdoors` and other base models. Removing a
base jar while retaining the expansion can break resources even before considering
declared dependencies. Dramatic Doors ships compatibility assets and classes for many
absent mods and multiple loaders; its 1,929 candidates are especially unsuitable as
an asserted live registration count.

The override scan records four exact file collisions, all from Pixlli: vanilla chain
and lantern item models and oak/dark-oak plank textures. No direct file collisions
were found in the checked KubeJS asset trees or the other installed resource packs.
It does not subtract these from the jar counts.
Jar-owned assets also contain shared/vanilla paths. External packs can replace donor
textures used by material-driven blocks without colliding with a furniture namespace.
Moonlight's merged pack and other generated runtime resources were not materialized;
the table is a root-jar resource inventory, not the effective resource manager.

## Overlaps and material expansion

| Function | Overlap | Difference that prevents automatic substitution |
|---|---|---|
| Seating/tables | Macaw Furniture, Handcrafted, Cluttered, Friendly Furnishings, Refurbished, Interiors | Scale, silhouette, palette, sitting behavior; Interiors' upholstered/train-oriented pieces |
| Storage/kitchens | Macaw Furniture, Handcrafted, Cluttered, Friendly Furnishings, Refurbished | Slot counts, inventory persistence, appliances, power and interaction contracts |
| Beds | MultiBeds, Handcrafted, decorative bedroom sets | Sleep/spawn behavior versus visual props; layered/component-driven bed appearance |
| Lighting | Additional Lanterns, Create Deco, Cluttered, Refurbished, Domum, Supplementaries | Emission, electrical behavior, mounting and industrial versus domestic styling |
| Doors/windows/trapdoors | Macaw suite, Dramatic Doors, Roundwood, Domum | Heights, assembly occupancy, animation, shutters, curved geometry and material editing |
| Roofs/stairs/rails/paths | Macaw suite/BOP, Domum, Roundwood arches/trim | Shape/topology and collision; a material change does not reproduce another shape |
| Paintings/small decor | Macaw Paintings, Cluttered, Handcrafted, Joy of Painting | Curated art versus player-authored art and functional display/storage objects |

Wood families are grouped by an explicit wood-token list in `scripts/assets.py`; they
are a conservative lexical measurement, not semantic equivalence. BOP's species are
included. Colour, shape and style tokens remain in the family key.

| Family | Measured expansion | Representative IDs and exceptions |
|---|---|---|
| Macaw Furniture | **62 families × 10 woods = 620** of 652 candidates | `mcwfurnitures:oak_bookshelf`, `...:spruce_bookshelf`; bamboo is absent from this ten-wood set; 32 other candidates remain |
| Handcrafted | **15 × 11 = 165** of 267 | `handcrafted:oak_bench`, `...:bamboo_bench`; the remaining 102 include colour/style/other decor, not 102 more wood shapes |
| Macaw BOP | **153 × 13 + 1 × 12 + 2 × 5 = 2,011** of 2,035 | `mcwbiomesoplenty:fir_attic_roof` through 13 species including empyreal, maple and pine; incomplete families and 24 unmatched candidates prevent treating all 2,035 as one rectangle |
| Refurbished | **208 across 21 repeated wood families**, predominantly ten woods | `refurbished_furniture:oak_basin`, `...:warped_basin`; not every shape has ten variants; appliances and coloured furniture are separate |
| Macaw Roofs | **14 × 11 = 154** wood candidates of 605 | `mcwroofs:oak_attic_roof`; stone/colour/style families account for much of the rest |
| Roundwood historical aliases | **3 × 11 = 33** wood IDs | `roundwood:oak_round_door`, `...:oak_round_window`, `...:oak_round_trim`; four paint aliases per family plus four masonry trims bring legacy blocks to 49 |

For illustration, ten wood-specific shapes with four facing states have 40 states;
one shape with ten-valued `wood` and four-valued `facing` also has 40. Adding an
independent 16-valued colour property makes 640, even if many combinations are not
useful. These are arithmetic examples, **not inferred state totals for the jars**.
Handcrafted's 60,921 explicit variant keys across 267 files show that state/model
expansion is a separate axis from the number of wood IDs.

## Block entities and rendering verdict

**Separate variant blocks** spend registry/state/resource/index surface up front.
Parent models and shared textures already amortize parts of that cost. Ordinary
baked geometry is drawn from chunk meshes, so unused registrations do not each add
a per-frame block draw. Removing files can reduce candidate load work, but the exact
loaded subset and retained objects require a matching client measurement.

**A material-valued blockstate property** reduces IDs, not the Cartesian product of
states. It can introduce invalid combinations, and it still needs models/resources
or a dynamic model strategy. “One block” alone is not a performance design.

**BE material data plus cached chunk geometry** avoids enumerating every material
combination as states. It adds per-placement NBT/components, network synchronization,
model-data invalidation, rebuild work and material caches. A BER is a separate choice:
its rendered instances execute per-frame rendering; a BE does not inherently do so.

### Roundwood 0.17.0

Installed SHA-256: `b6877267cdb2cabd49a4df4c1e88205c310e5026e857d2f16439bc648274c006`.
Owned source inspected read-only at `minecraft-mods/mods/Roundwood`, commit
`8b9a89a4725f29e64c46157dea9893abf11b765b`; installed class methods/constants agree
with the responsibilities below. The existing local 0.17.0 build jar has the same
SHA-256 as the installed jar. No source rebuild was performed.

- `registry/ModBlocks`, `WindowProducts.all`, `ArchPieceDesign`, `LegacyContent.register`
  reconstruct **91 block registrations**: 4 doors + 27 windows (14 plain, 13 retained
  crossed) + 2 retired archways + 8 full/thin arch pieces + 1 trim + 49 old aliases.
  Thus **27 current base blocks + 64 retained identities**, not 27 total.
- `registry/ModItems` and `LegacyContent` reconstruct **94 item registrations**:
  29 current items, 13 retired crossed windows, 2 retired archways and 50 legacy items
  (49 block aliases plus item-only `window_trim`). There are 98 item model files.
  `ModItems.all()` exposes 29 current items; comments saying 20/22 blocks/items are
  stale. This still does not measure the final EMI index after pack rules.
- `registry/ModBlockEntities` declares **5 BE types**: door, window, trim, archway and
  arch piece. Associated blocks include aliases through class-filtered registration.
  Assembly anchor counts are not necessarily equal to occupied block counts.
- `appearance/Appearance`, `block/attachment/AppearanceAnchorBlockEntity` persist
  donor identities and attachments, with save/update handling. Namespace-only remaps
  cannot preserve their appearance contract.
- `RoundwoodClient.registerRenderers` has one decoded binding invocation, for
  `ROUND_DOOR` → `RoundDoorRenderer`; `WindowAppearanceModel` and `StaticWorldModel`
  wrap static models. This is a hybrid, not an all-BER design.
- `AppearanceModelCache` uses synchronized bounded LRU caches (default model capacity
  2,048 per cache), cleared on reload. This is not a global 2,048-model memory bound.
- `RoundwoodEmiPlugin.register` removes aliases and sets component-sensitive comparison;
  it does not enumerate the donor cross-product as EMI preview entries.

### Domum Ornamentum 1.0.236-snapshot-main

Pin SHA-1: `31b16b65eb0cc26473bcd607b1c7f386aa99680f`; SHA-256 is in `assets.json`.
Independent installed-bytecode evidence under `com/ldtteam/domumornamentum/`:

- `entity/block/ModBlockEntityTypes.<clinit>` has two actual deferred registration
  calls (bytecode offsets 25 and 45): materially textured and dynamic timber-frame
  types. Block association is selected by material-interface/type tests; it is not
  one BE type for every material variant.
- `MateriallyTexturedBlockEntity` saves/loads texture data, synchronizes it and supplies
  `getModelData`; `DynamicTimberFrameBlockEntity` also maintains its texture cache.
- `client/model/baked/MateriallyTexturedBakedModel` directly implements `BakedModel`.
  Its extended `getQuads` calls `getBakedInnerModelFor` then the selected model's
  `getQuads`. The constructor builds separate block/item Guava caches, each with
  maximum size **10,000**, plus expire-after-access configuration. These are per
  model cache limits, not an observed retained-size total.
- No root-class BER interface or binding match was found. Positive evidence is the
  material-aware baked-model path, not an inference from BE storage. Preview ghost
  rendering is a separate path. Dynamic/model and item rendering still need profiling.
- The jar has 201 `domum_ornamentum:materially_textured` model-loader declarations
  and eight NeoForge composite declarations. Its 100 blockstate files and 118 item
  models do not enumerate all material combinations.

**Pack verdict:** both material-data approaches can control eager material-variant
enumeration and EMI clutter. Neither establishes a net startup, memory or frame-time
win here. Replacing already chunk-baked furniture with universal BER furniture could
make a busy room worse. Prototype a static cached shape only after choosing a style
and identifying an actual bottleneck; retain per-frame animation only where needed.

## Historical world usage

Only the archived pre-cutover `New World` was copied/read. The live Stable save was
never opened. The archive predates NeoForge cutover, so historical namespaces and
payload layouts can differ from the currently pinned jars.

<!-- survey-world -->
The inventory processed **328 files and 42,783 terrain/entity chunk records**, with
**zero parse errors**, retaining 6,308 entity records, 12,734 BE records and 2,239
item-shaped records pack-wide. Source and snapshot both verify at **375,157,633 bytes**.
Entity/BE evidence covers `minecraft:overworld` and `minecraft:the_nether`; traversal
also reads region files regardless of whether furniture or entities are present.

| Namespace with observed reviewed-content placements | Placed blocks | Saved BEs |
|---|---:|---:|
| `domum_ornamentum` (primary) | 70 | 68 |
| `supplementaries` (adjacent) | 6,994 | 144 |
| `adchimneys` (adjacent) | 5 | 5 |
| `minecolonies` (dependency/context) | 298 | 6 |

All other primary and adjacent namespaces had zero decoded terrain placements and
zero matching BE records. The table does not measure painting entities as blocks.
The snapshot also contains **6,071,782 `biomesoplenty` placements**: no inference that
the material supplier is disposable follows from zero BOP furniture placements.

Domum's blocks are 36 shingles, 11 horizontal plain frames, 9 plain frames, 5
left-to-right crossed frames, 4 right-to-left crossed frames, 3 framed blocks and
one each of beige stone bricks and beige bricks. One BE at `(1006, 70, -584)` stores
`minecraft:block/oak_planks` → `minecraft:spruce_planks` and a clay slot mapped to
`domum_ornamentum:cobblestone_extra`. These donor references are not extra placed
spruce blocks; they are essential appearance data.

| Namespace | Stored-stack candidate quantity | Template/request/display | Other reference quantity |
|---|---:|---:|---:|
| `minecolonies` | 38 | 0 | 0 |
| `supplementaries` | 37 | 51 | 18 |

No primary matching item-shaped records were found by this decoder. There were no
`create:` entity records and no matches for the eleven reviewed mounted-storage type
IDs in decoded entities/BEs/saved data (`create-entities.json` and `world-summary.json`).
This does not certify absence of an unknown historical mounted codec or opaque payload.

Nine files remain outside the generic NBT decoder: Collective's item-name translation
text, CPM JSON, JEI's server-id text, two `.cosarmor` player sidecars, a Quick Skin
appearance JSON, its texture ownership file and PNG, and `xaeromap.txt`. Their exact
paths are in `world-summary.json`; no contents were assumed empty. POI, stats,
advancements, configs, backups and lock/icon files are separately classified auxiliary
inputs. These coverage limits are why this report does not certify non-use.
<!-- /survey-world -->

Counts decode packed section palettes rather than counting palette membership.
The inventory includes current terrain/entity regions across saved dimensions,
offline player `.dat`, nested compounds, saved structures and mod `.dat` data.
Raw items retain file/chunk/NBT-path provenance; BEs retain coordinates. Terrain
placement totals are aggregated; individual placement coordinates are not exported.
The manifest-backed snapshot retains the original data for later location/remap work.

Item records are intentionally separated into stored-stack candidates, mounted/nested
candidates, template/request/display candidates, and the `level.dat` player mirror.
They are not summed into a supposedly physical global inventory. Dank `ExtendedCount`
takes precedence over byte `Count`. Nested item projections can still describe the
same holding or a template; these categories are investigation evidence, not an
audited conversion balance. Create mounted payloads and material/attachment references
are retained separately, never added to terrain placement totals.

Custom sidecars, opaque byte arrays, historical backups and unsupported codecs prevent
a complete absence claim. No zero in this report authorizes removal. A later converter
needs a fresh stopped-world copy and must preserve block states, inventories, components,
attachments, donor identities, multi-block occupancy and mounted Create payloads,
followed by source-absent reload/restart acceptance. The owned migration bridge is a
possible implementation home, not evidence these mappings already exist.

## Adjacent review

<!-- survey-adjacent -->
| Adjacent mod | B | Models B/I/O | PNG | BE hints/BER/T | Historical placed/BE | Disposition |
|---|---:|---:|---:|---:|---:|---|
| Connected Glass | 119 | 5/119/426 | 152 | 0/0/0 | 0/0 | Include glazing overlap; connected appearance is distinct |
| Chimes | 6 | 10/6/0 | 41 | 11/5/2 | 0/0 | Include hanging decor; sound and animated renderers differ |
| Joy of Painting | 0 | 0/30/0 | 32 | 0/0/0 | 0/0 | Include authored art; entity/canvas data, not block variants |
| Hammer Microblocks | 0 | 0/7/0 | 5 | 0/0/0 | 0/0 | Include shape/material alternative; multipart storage needs a codec |
| Supplementaries | 274 | 1353/305/142 | 1193 | 87/22/20 | 6994/144 | Keep functional decor and observed storage/placements |
| Amendments | 52 | 151/2/0 | 178 | 30/5/6 | 0/0 | Keep behavior changes around existing decor; assets understate reach |
| Diagonal Fences | 0 | 0/0/0 | 0 | 0/0/0 | 0/0 | Keep compatibility; generated content/nested provider |
| Advanced Chimneys | 12 | 70/12/65 | 4 | 4/1/0 | 5/5 | Include structural decor; chimney/smoke/pump behavior differs |
<!-- /survey-adjacent -->

MineColonies, Structurize and StyleColonies remain context/dependency candidates,
not furniture-removal targets. Schematics and construction requests may name furniture
without placing it. Biomes O' Plenty and other wood/material suppliers remain inputs
to expansion and donor models; removing their consumer does not make them orphaned.
Diagonal Fences has runtime-generated content: zero own blockstate files is not zero
blocks. Hammer Microblocks and painting entities likewise defeat a block-file-only
definition of decorative content. Do not trim a shared library without a whole-pack
declared/bytecode/resource consumer audit, including nested jars.

## Options and next step

| Option | Concrete target and gain | Cost | World-data risk |
|---|---|---|---|
| Keep variants | Preserve every style, BOP material match and Refurbished appliance behavior | Retain the measured resource/index surface; runtime cost still unknown | None from this survey |
| EMI-hide selected duplicates | Owner-selected Macaw/Handcrafted seats, tables and plain openings; easier browsing | Small curation list plus recipe-access check; **no registry, state or model-bake savings** | No save conversion; reversible |
| Remove with remap | Only a rejected style/mod after selection; removes its jar resources and possibly exclusive dependencies | Dependency/resource closure, exact state/item/BE mapping and parity fixtures; savings bounded by actually loaded resources | High: old inventories, aliases, schematics, material donors and mounted payloads survive outside visible terrain |
| Owned material-driven set | A small original static chair/table family; potentially fewer eager variants and a controlled item surface | Original art, donor model/tint handling, cache bounds, sync, recipe/EMI integration and ongoing maintenance | Low if additive prototype; high when replacing existing IDs; no proven performance payback yet |

Recommended sequence: owner shortlist → reversible **DECOR/index** experiment for
selected duplicates → measure comparable client reload and representative rooms →
consider one additive cached-model prototype or a narrowly justified removal.
Existing **CLEAN can filter recipe displays**; **DECOR only filters the index**.
Adding CLEAN rules does not promise index-only behavior. Preserve access to recipes,
Refurbished's wrench/electrical/storage tools and all required crafting inputs.

## Owner-run measurement recipe (not run)

In an already-running **disposable, pin-matching client**, one command starts a bounded
local CPU capture with the installed spark 1.10.124 command surface:

```text
/sparkc profiler start --thread * --timeout 120 --save-to-file
```

Immediately exercise an F3+T resource reload, then the same fixed-camera furniture
scene; keep the saved profile. Installed `SamplerModule.registerCommands`, `profilerStart`
and `profilerStop` contain/consume `thread`, `timeout` and `save-to-file`; the start path
also reads the save flag. No profile was generated by this survey. A 120-second timeout
is a capture duration, not a model-bake result. Manual stop, if needed:
`/sparkc profiler stop --save-to-file`.

This measures exercised reload/scene work, **not earlier startup**. For startup, enable
JFR from JVM launch in that disposable instance, record resource/model load and bake
boundaries separately from total launch and EMI reload, and repeat comparable runs.
Hold JVM, heap, configs, pack order, shaders, resolution, hardware and camera fixed;
record all drift. Use distributions across repeated runs, not one guessed per-mod time.

Additional runtime acceptance: enumerate blocks/items/possible states and registered
BE types; count component-sensitive EMI master entries and CLEAN/ALL × DECOR views
after reload, with local hides recorded; inspect retained heap after consistent GC
boundaries and cache warm-up; compare equal-population scenes, settled frame times and
forced chunk rebuilds. Distinguish shared model objects from references, custom dynamic
quads from enumerable baked models, and differing geometry from renderer architecture.
Server TRACE timing and pre-main mixin audits cannot answer client bake timing.

## Owner-only style questions

1. Which seating/table language should lead: Macaw, Handcrafted, Cluttered's themed
   props, Friendly Furnishings' patterned sets, Refurbished or Interiors upholstery?
2. Is matching every BOP wood important, or would a curated wood palette be preferable
   in the default browser while all variants remain obtainable?
3. Which short/tall/curved doors, shutters, roof shapes and railings are indispensable?
4. Which Refurbished appliances and functional storage are actually wanted? Which
   bedroom pieces must support sleeping rather than only appearance?
5. Should decorative alternatives be hidden by default or remain in the main index?
   Are any visual substitutions acceptable in existing builds?

These are unanswered preferences, not accepted design decisions. No style, recipe,
mod, saved identity or player-visible feature changed in this survey.
