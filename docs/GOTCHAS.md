# Gotchas

## Tool layout

- **ANU runs a synced copy of `tools/` with the same relative layout.** `pack_test/remote/anu.cjs` `CODE_DIRS` and
  `remote/scripts.cjs` `AGENT_SCRIPT` name `testing/server_smoke`, `testing/pack_test`, `analysis/emi_coverage`,
  `analysis/dedup` and `data_io`; moving any of them means updating those, or the remote agent's relative requires
  and its kill-guard command-line match break (the `signoff` test covers the kill guard).

## Client mixin verification

- Dedicated-server acceptance never applies CLIENT-only mixins. DRT 0.2.0 demonstrated the
  gap: its JEI injection produces a `VerifyError` only when `RecipeTransferManager` loads.
- Loading a class can defer verification. The client audit reflects constructors with
  `-Xverify:all`; it never initializes targets or calls Minecraft's main. Reflecting every
  method also resolves optional method-signature APIs (Create's ComputerCraft integration),
  producing false missing-class failures; constructor reflection avoids that extra resolution.
  A startup log without a completed target sweep is not a pass.
- NeoForge's client classpath needs the mapped Minecraft `client-srg` and `client-extra`
  jars as well as its patched client jar. Sodium probes adapters before the early-window
  decision, so the cached Windows native jars are needed even without a display.
- A diagnostic exclusion changes the mod set. It cannot qualify the full pinned pack for
  owner hand-off. Retain both input manifests and the unmodified-pin failure evidence.
- The first complete sweep found Thirst's `jade.MixinFluidView` redirect failing with
  `(0/1) succeeded`. Thirst 2.1.5 expects Jade's pre-DynamicOps `FluidView.readDefault`;
  Jade 15.10.3 matches, while 15.10.6 does not. Thirst has no Jade version constraint or
  compat toggle, so do not update Jade independently without rerunning this audit.
- Missing and unhandled targets are reviewed only through the exact reasoned entries in
  `tools/testing/client_mixin/allowlist.json`; there is no blanket exemption. Bootstrap-layer
  classes can link successfully without traversing the game transformer, so the final
  unhandled-target check plus exact baseline prevents new blind spots from passing.
  A deliberately accepted behavior loss must be marked `known-minor` with its Docket id;
  Railways' Controls-screen cosmetic issue is the sole current example (dk-2d33cee0).

## Copied-world conversion

- I&F beta-5 stores dragon `Variant` as an integer; CE saves a name. Stable's pinned
  `EntityFireDragon#getVariantName` maps 0–3 to red/green/bronze/gray; ice maps to
  blue/white/sapphire/silver; lightning maps to electric/amythest/copper/black. The
  world-trial comparator recognizes these verified names. Age, gender and UUID must
  still match. Evidence: `jobs/2026-10-30-world-trial/losses/*-dragon-bytecode.txt`.
- Region files can contain pending entities in partially generated terrain as well as
  current entities in `entities/*.mca`. This save has 26 current wild dragons and one
  pending terrain dragon. Keep those populations separate when comparing generation.
- Dank `ExtendedCount` is authoritative; its legacy byte `Count` can be negative after
  wrapping. Experience-orb entities also carry `Count`, but are not item stacks.
- KubeJS exposes level dimension and entity UUID as properties. PlayerList's single-player
  `save` is protected and `getPlayers()` is unmodifiable. The world probe uses the public
  `remove(player)` logout path, verified in pinned bytecode to invoke save first, for
  original-UUID stand-in players. It never adds them to the active player list.

## Mod map timing

- Forge 47.4.10 DEBUG logs expose container creation and aggregate deferred queues,
  not paired per-mod durations. Inspection of the installed `FMLModContainer`
  bytecode (`javap -c -p`) confirmed TRACE pairs: `Loading/Loaded mod instance`,
  `Injecting/Completed Automatic event subscribers`, and `Firing/Fired event for
  modid`. Mod-map enables just that logger at TRACE in its disposable server.
- Pair by mod ID, thread and exact event identity, before `Done`; never charge a
  gap between unrelated messages to a mod. Dates handle midnight. Timestamps have
  millisecond precision, so measured zero is possible; missing pairs are warnings.
- Construction, subscriber registration and event-handler elapsed time exclude
  deferred work after event return, much resource loading, discovery, mixins and
  world loading. Parallel workers overlap, and class-loading waits may be charged
  to whichever constructor triggered them. Sums are not exclusive wall time and
  cannot predict the time saved by removal. TRACE adds overhead; this is one boot,
  not a benchmark. Client-side startup/render costs cannot be measured here.
- Exact cached worlds are keyed by jar names and seed. An explicitly supplied older
  cached world is copied, never modified in place; its different mod-set provenance
  remains visible. This avoids fresh spawn generation but can produce missing-mod
  warnings. A missing exact cache without `-World` fails before starting Java.
- Mandatory dependency graphs do not generally capture KubeJS recipes, optional
  integration code or saved-world requirements (notably Terralith). The mod map's
  checked-in overrides record only confirmed exceptions such as HammerMicroblocks'
  undeclared HammerMultipart calls and the documented pack-wide fixes. A nested
  dependency is a
  removal candidate, not proof it is safe to delete. Embedded mods remain inside
  provider jars; multi-mod jars cannot be split by this report.
- First capture (2026-10-27, Valhalla, copied older cached world): 48.993 s from
  JVM spawn to `Done`, 192 logged mod IDs with paired measurements and no unmatched
  pairs. The original top-group page ranked Steam 'n' Rails at 4.352 s; the family
  page rolls add-ons into their bases and can count a shared add-on in more than one
  family while its page-wide total stays unique. These numbers describe
  that instrumented boot only. GeckoLib occurs externally and embedded: the map
  coalesces the ID for timing and retains provider provenance rather than counting
  two runtime mods. Witch Huts and Kotlin for Forge have no root Forge `mods.toml`;
  their physical jars remain visible with unmeasured cost.

## Gameplay and showcases

- **Roundwood 0.13.3 Cross Beams are attachments.** The native showcase's sample
  persists `WindowCrossBeams` with a `Front` compound on `roundwood:round_window`;
  searching only legacy `_cross` block IDs falsely reports it missing. Its
  `/roundwood showcase` requires a player source and clears its entire display
  volume without pack plot reservations; see [showcases](showcases.md#roundwood-native-showcase).

- **Read command-source Vec3 coordinates with `x()`, `y()`, `z()`.** This Rhino
  version exposes their field/method collision as `FieldAndMethods`; coercing
  `position.x` to a number throws a Java `NullPointerException` outside the JS
  catch. The showcase's first live run exposed it; its command test uses method
  accessors to prevent regression. Vec2's rotation `y` is a plain field.
- **Showcases must never ask the player for flat ground or an empty plot.** The
  owner (2026-10-25) was refused twice on an ordinary field ("Need flat solid
  ground", "Move entities out"). The builder now makes its own plot (see
  showcases.md); only build height, border, unloaded chunks and protected
  (player/tamed/named) entities refuse. Do not reintroduce flatness or occupancy
  preflight in a section or the builder.
- **WorldBorder's `isWithinBounds(BlockPos)` overload is ambiguous in Rhino.**
  Compare the full plot extents with `getMinX/getMaxX/getMinZ/getMaxZ` instead;
  this also checks the far edge of the last block, not only its integer origin.
- **Vanilla `/fill air` can pop support-attached blocks while clearing.** The
  first showcase rebuild left a `minecraft:lever` item entity, confirmed in the
  saved world's entity NBT, so a later rebuild correctly refused the occupied
  plot. The builder detaches inventory block entities, then clears with
  `UPDATE_CLIENTS | UPDATE_KNOWN_SHAPE | UPDATE_SUPPRESS_DROPS` (50). The live
  checks require exactly one glue and no dropped items after rebuild.
- **KubeJS entity `getType()` returns namespaced IDs.** Match `create:super_glue`
  when recognizing owned glue. Using a vanilla description key caused the
  showcase to reject its own glue on the second invocation.
- **Create's asynchronous collision calculation can first-load Canary classes
  through the common pool's wrong classloader.** A fresh bearing assembly logged
  `Could not find parent it/unimi/dsi/fastutil/doubles/AbstractDoubleList` for
  `OffsetFractionalDoubleList`; functional storage checks still passed. Showcase
  motor startup in `showcase/rigs/create_contraption.js` now computes the glued blocks' collision unions on the server
  thread before enabling speed. The full headless run then passed with no new
  warning/error groups. This is local preparation for showcase rigs; ordinary
  contraption assembly outside showcases has not been changed.

- **Drawer quantity text needs the quantify flag.** Storage Drawers 12.15.1
  `BlockEntityDrawers.readPortable` reads `Qua`; without it prefilled drawers
  can show icons without counts. Showcase plans use `{Qua:1b}` and the headless
  check asserts `isShowingQuantity()`. This enables the feature; rendering still
  needs client inspection.
- **A showcase reservation is destructive on rebuild.** Use a disposable area
  and repeat from the same position/direction. A reserved plot can be reset even
  after block edits; clear retains its stone-brick floor. Create can restore glue
  on disassembly, so teardown removes that restored glue before adding a new
  payload. See [showcases](showcases.md) for boundaries and commands.

## Packwiz hashes (no packwiz CLI here)

- Hashes cover **LF bytes**. Git stores and GitHub serves LF (`core.autocrlf=input`, plus `.gitattributes`). A file saved with CRLF or a BOM hashes differently from what the installer downloads.
- A clean `git status` does **not** mean the working tree is LF. On 2026-10-11 the main checkout had 372 CRLF config files that git still reported clean (it compares after conversion). the installer would have read those CRLF bytes and failed the hashes. Check with `git ls-files --eol | grep w/crlf`; fix by deleting those files and `git checkout -- <paths>` (the index copies are LF).
- `tools/packwiz/rehash.cjs` refuses CRLF/BOM files rather than normalizing them, and `verify_hashes.cjs` reports them.
- Order matters. Save the file, rebuild `index.toml` (its sha256 entries), and only then hash the final `index.toml` into `pack.toml`. `rehash.cjs` does both steps in that order.
- Metafile `[download]` hashes describe the **jar bytes**, a separate layer from the index hash of the `.pw.toml` itself. Check jars with `verify_hashes.cjs --jars <dir>`; that checks matching hashes, not that every expected jar is present.
- `.packwizignore` keeps `tools/`, `docs/`, `STRUCTURE.md`, `CLAUDE.md`, `AGENTS.md`, `README.md` and `docket.json` out of the index, so editing them never needs a rehash. (`README.md` was published until 2026-10-12.)
- After a push, fetch `https://raw.githubusercontent.com/dirtyredz/evil-eye-pack/<branch>/pack.toml` and check that its index hash matches the local one.

## Installer and instances

- `.minecraft/packwiz.json` is the installer's record of the files it manages. It is how removed mods and configs get deleted on the next sync. Keep it when copying an instance; deleting it leaves stale jars behind.
- The installer overwrites non-preserve pack-managed configs when their pack version changes. Runtime-rewritten settings and shader option sidecars are `preserve = true`: they install when missing and then keep the owner's/game's bytes. Do not post-verify those bytes against the source hash. `options.txt`, Sodium/JEI outputs and local EMI decor marks are unshipped and never installer-owned; authored inputs such as `config/defaultoptions/keybindings.txt` and `config/emi-curation/` remain non-preserve pack policy.
- Local instances install straight from the checkout's files (no server) and never rehash. Rehash and verify before every local install, and do not edit files while an install is reading them.
- **A "Failed file downloads" dialog listing a few random files is usually a download timeout, not a pack defect.** The installer fetches many files in parallel over HTTP/2 with a short stream timeout and two retries, so a large sync (such as a merge adding ~60 files) can leave a few with `SocketTimeoutException`; which ones varies per run. It writes no log file (`MultiMC-0.log` only says "PreLaunchCommand succeeded"). Relaunch: it re-fetches only the missing files. Suspect the pack only if `verify_hashes.cjs` fails or the same file fails again (2026-10-22: ETF, Modern UI and `cosarmorinventory.png` all succeeded on relaunch).
- MultiMC's instance ID is the **folder name**; the display name is `name=` in `instance.cfg`. Renaming the display name does not rename the folder. Rename folders only with MultiMC closed, and update `SelectedInstance` in `multimc.cfg`.
- **MultiMC `instance.cfg` eats backslashes; owner launch paths must not wait on JVMs.** Its INI reader treats backslashes as escapes, so every value tooling writes must use forward-slash paths and remain unchanged by backslash unescaping. Owner client pre-launch/install commands run immediately even when unrelated Java processes exist; the one-Minecraft-JVM host wait belongs only to agent headless server boots.

## Mod updates and removals

- **Day length is global now, and NeoForge remembers it per world.** Evil Eye Tweaks reads `[time]` from
  `config/evileye_tweaks-common.toml` (not a per-world serverconfig as Hourglass did) and sets NeoForge's
  day-time rate, which NeoForge saves in each world's level.dat. Old worlds keep an unread
  `serverconfig/hourglass-server.toml`; `/neoforge day` is overridden on the next tick.

- **FlatWorldFix only affects worlds created while it is installed.** A chosen non-default world type (including Superflat) wins over datapack overworld overrides; default worlds retain Terralith. It does not change existing saves.

- **AllTheOres/AllTheCompressed/Almost Unified were removed on 2026-10-23.** The owner abandoned migration after a partial in-game swap. Old stacks and blocks disappear; no remap or conversion remains. Keep Large Ore Deposits on explicit survivor IDs.
- **Duplicate removal must cover custom serializers and code drops.** `tools/analysis/dedup/generate.cjs` preserves full pinned recipe/loot JSON; regenerate and run its tests when jars change. BHC wither bones are a Java drop (`boneDropRate = 0.0`), not a loot-table entry. Ice and Fire tag-selected nuggets need tag cleanup as well as loot overrides. HammerLib recipes and dynamic tags have separate switches. Refurbished Furniture's wrench has electrical-link behavior and cannot be replaced by Create's wrench.
- **Extreme Reactors needs `forge:ingots/steel` non-empty.** Its reinforced parts are `forge:conditional` recipes gated on `tag_empty`; an empty tag silently switches them to iron-block `_alt` recipes and leaves 14 empty Patchouli pages. On `main` the pack tags Ender IO Dark Steel into it via `dedup.json` `extraItemTags`; on the NeoForge branch Mekanism's steel fills `c:ingots/steel` and the stand-in is gone, so removing Mekanism empties it again.
- **Keymap changes need a regenerated check and a manual strip.** `config/defaultoptions/keybindings.txt` is read only for keys missing from `options.txt`. Mod keys are not unique across mods (Jetpack G/H, Dank I/O, AstikorCarts Z/R); after adding a mod, simulate the merged map (instance `options.txt` plus the keymap) for duplicates, and treat GUI-context keys (JEI, Xaero GUI) as non-clashes.
- **Cluttered's jar mis-tags `cluttered:willow_door` as a trapdoor.** Duplicate replacement copies jar tags to the survivor, so `dedup.json` `tagFixes` corrects the target after mapping.
- **Permanent duplicate hiding uses EMI native index removals** (`item:namespace:path`), so ALL cannot reveal retired copies. This is separate from reversible cosmetic curation. Registered copies can still exist in old inventories/creative; no runtime converter is installed.


- **Two unrelated mods are both called "Fusion" and both use mod id `fusion`.** CurseForge project 226139 is Alexndr/Sinhika's SimpleOres alloy add-on (`Fusion-1.20.1-6.0.0.3.jar`, needs SimpleCoreLib); SuperMartijn642's Fusion (Modrinth `p19vrgc2`, CurseForge "fusion-connected-textures") is the connected-texture/model library Connected Glass and Ender IO's glass need. The pack shipped the wrong one from the initial commit, so every `connectedglass:` model failed with `Model loader 'fusion:model' not found` (425 errors) and the glass rendered as missing textures. Pin SuperMartijn642's by Modrinth direct URL, and check `META-INF/mods.toml` (`authors`, `description`) when a metafile is named only "Fusion". Fusion 1.3.x removed API classes (`fusion/api/model/data/*`, `api/predicate/*`) that Connected Glass 1.1.14 references, so the pack pins 1.2.12 (the last 1.2.x; Connected Glass needs `[1.2.9,)`).
- **Forge hits a missing class only when the code runs.** A mod compiled against an older API loads, then throws `NoClassDefFoundError` from its compat setup (a deferred task), which leaves mod loading "broken" and crashes the client later with an unrelated-looking NPE. Before a big API bump (Create 0.5 → 6), scan every installed jar's class constants for references the new jar no longer has (`jobs/2026-10-18-create6/tools/createrefs.mjs`).
- **Ender IO below 6.2.11 cannot run with Create 6.** `EnderIO-1.20.1-6.0.23-alpha` calls `com.jozufozu.flywheel.core.virtual.VirtualRenderWorld` (Flywheel 0.6) from `FlywheelCompat.getExistingBlockEntity`, reached from `MachineBlock.getLightEmission`; with Flywheel 1.0 it throws `ClassNotFoundException` during Embeddium chunk meshing, so any chunk holding an Ender IO machine never meshes and the world hangs on "Loading terrain". Ender IO 6.2.11-beta is the first release with Create 6 compatibility (and is incompatible with older Create); the pack pins 6.2.18-beta (latest 1.20.1 build, Modrinth direct URL). The 6.1+/6.2 line reworked conduits, so check old conduit networks in existing worlds. 6.2.18 adds config keys (`machines-common` stirling fuelEfficiency*, aversion capacity/usage; `machines-client` aversionRangeColor) that Forge writes as defaults on first boot; they are copied into `config/enderio/`. Athena/Fusion "model loader not found" errors for Ender IO capacitor-bank and glass models also appear on 6.0.23 and are not caused by the update.
- **Worldgen mods can be baked into `level.dat`.** Terralith worlds store the overworld's whole multi-noise biome list inline (`Data.WorldGenSettings.dimensions."minecraft:overworld".generator.biome_source.biomes`). Terralith is therefore kept in the pack and cannot be removed from an existing world. Without the mod the world refuses to open ("Overworld settings missing"). Replacing that `biome_source` with `{type: "minecraft:multi_noise", preset: "minecraft:overworld"}` detaches it (`jobs/2026-10-18-create6/tools/detach_terralith.cjs`, on a backed-up copy only); already-generated Terralith chunks keep their blocks but their biomes fall back.
- **Evil Eye Client ships `assets/appleskin/` on purpose.** The food sheet keeps AppleSkin's resource path so CozyUI+'s re-skin applies after AppleSkin's removal. Thirst Was Taken still checks `ModList.isLoaded("appleskin")` and draws nothing extra; Evil Eye Client's thirst adapter covers it.
- **The library closure script's metadata check must split `unzip -Z1` output on `\r?\n`.** The wave-1 version split on `\n` only, so on Windows its metadata branch never matched (class references still did). Always confirm a library drop with `migrate.mjs resolve`, which checks declared dependencies (it caught AttributeFix requiring Bookshelf).
- **The "Unidentified mapping" list in `latest.log` is the content a world loses** after a removal or rewrite: every registry ID the world knew that no longer exists. Read it before shipping a removal.

## Server smoke (`tools/testing/server_smoke/`)

- **A mod marked `side = "both"` can still be client-only.** packwiz `-s server` installs every `both` mod, and Forge aborts server boot at the first one that touches client classes. Oculus 1.8.0 (`side = "both"`) crashes the server: `Attempted to load class net/minecraft/client/gui/screens/Screen for invalid dist DEDICATED_SERVER`. Forge reports only the first failing mod and leaves the JVM alive after "Crash report saved", so the smoke stops on that line. Use `--drop <name>` to find the next offender, then fix the metafile's `side`.
- **Known server boot noise** (observed 2026-10-18 on a successful boot, listed in `tools/testing/server_smoke/known_noise.json`): datapack tags, recipes and advancements from dramaticdoors, productivebees and totw_modded that reference mods the pack does not ship (Mekanism and others); Radium probing Minecolonies `BlockHutTownHall` (`RuntimeDistCleaner ... ClientLevel`); Structurize's ModernFix `LazyDataFixer` banner; HammerLib's test recipe extension. Mixin "Error loading class ... ClassNotFoundException" lines are WARN, not errors.
- Time to `Done (` with a fresh world, measured 2026-10-23: 136 s wall on Valhalla with a light load, 527 s while Valhalla was busy with other work, 135 s on ANU. Spawn-area generation dominates; the pack test's cached world brings it to about 50 s. The JVM exits within a minute of `stop`.

## Pack test (`tools/testing/pack_test/`)

- **Old runs lack malware evidence.** Offline analysis now requires `evidence/malware.json`; its absence is incomplete, never a clean security result. Copy historical runs before backfilling from a verified matching stage. The later scan is new evidence, not evidence collected during the historical boot. Static approvals bind the outer jar/ZIP hash and exact finding; a dependency update must be reviewed again. See development's Malware guard section.

- **ANU refreshes must carry the acquired lease.** `remote/lease/dir_lock.cjs` returns `{ runId, claimId }` as the acquired `lease`, stored whole in `job.json` and passed whole to refresh and release. `ownsLease` matches it against `owner.json` (`owner` is the run ID). `remote/lease/lifecycle.cjs` captures that identity once in `startLease`. A missing, unreadable or replaced lease is never reclaimed by the agent. A failed heartbeat kills its owned process trees, reports an infrastructure error and exits 2. Keep the atomic heartbeat replace and the launcher's rule that an unreadable owner stays busy until the directory is stale.
- **Stage runtime exclusions are shared.** `stage_runtime.cjs` defines `STAGE_RUNTIME` from `WORLD`; both the local server copy and `remote/anu.cjs` sync use `isStageRuntime(rel)` to exclude those top-level paths, including `packwiz-install.log` and `console.log`. Keep the ANU agent independent of module-load order: pass Java/jcmd through `execute()` to `boot()`, and use explicit run/world-cache paths instead of setting `SMOKE_*` on `process.env`.
- **Read tags after the server has started, not in a tag event.** KubeJS's item-tag event fires more than once while data loads; the audit-2 probe saw `forge:ingots/steel` empty in the first call and filled in a later one. The probe reads final tags in `ServerEvents.loaded` through `Registry.getTag(TagKey)`.
- **Recipes can be missing for reasons a loaded-recipe scan cannot see.** Forge conditions (`forge:conditional`, `conditions`) drop recipes before KubeJS or the `RecipeManager` see them, and parse failures only reach the logs. The test reconciles raw data against the live manager. A recipe disabled by an empty tag is only a failure when the pack ships a fallback recipe for that tag with the same output (Extreme Reactors' `_alt` casings); AE2's matter-cannon ammo for absent metals is ordinary optional compatibility.
- **`rm.getRecipes()` is ambiguous from KubeJS.** It resolved to the type map in one context and to the flat recipe collection in another; the probe uses `getAllRecipesFor(type)` per registered type and checks the total against `getRecipeIds()`.
- **FastWorkbench computes the crafting result a few ticks later.** A scripted craft must fill the grid, wait (`server.scheduleInTicks`), then click the result slot. Reading the result slot immediately returns air.
- **KubeJS JSON lists cannot hold `null`.** `JsonIO.read` gives Java lists whose null elements throw a Java NPE that a script `try/catch` does not catch; probe inputs use `''` for empty grid slots.
- **`Recipe.getType()` from KubeJS returns the serializer id**, not the `RecipeType` (KubeJS mixes in its own `getType`). The probe records both: `type` from the registry walk, `ser` from `getType()`.
- **Acquisition is evidence, not proof.** Items obtained by trades, Java-coded drops or in-world conversion (waxing, stripping, filling a bucket, bucketing a mob) have no data trail; they need a reasoned exclusion in `data/policy.json` or a baseline entry. A block whose loot table only drops itself is reported as `unverified-source` (info), not a failure.
- **KubeJS can crash at mod construction with a `ConcurrentModificationException`** in `ScriptManager.load` (seen once in three boots on 2026-10-23, Valhalla). It is a startup race, not the probe (server scripts load later): `ScriptManager.load` line 192 walks the root registry's key set while another mod's constructor (parallel mod loading) adds a registry. The identified writer, CorgiLib, and its CorgiKubeJSCompat workaround were removed with Enhanced Celestials on 2026-10-27. If the crash recurs with another writer, KubeJS build.26 has no setting for it; `fml.toml` `maxThreads = 1` would serialise construction at a launch-time cost (Docket `dk-e9c3d82d`). The run reports it as an invalid run (exit 2). Rerun.

## NeoForge migration (`tools/packwiz/migration/`, runtime)

- **Many NeoForge 1.21.1 jars declare `minecraft [1.21,1.21.1)` and still load.** FML 1.21.1's
  `VersionSupportMatrix` retries minecraft/neoforge ranges with 1.21 / 21.0.166 on 1.21.1. A plain
  Maven check would reject JEI, Iris, Iron Chests and others; `dependencies.cjs` mirrors exactly this rule.
- **Maven versions are not dotted numbers.** A hyphen opens a sublist that ranks below a number at the
  same position: `1.21.1-3.7.2` > `1.21-2.20.0`, and `1.21` < `1.21z` < `1.21.1`. Use
  `compareVersions` (ported ComparableVersion), never a split on `.`.
- **Modrinth-generated datapack mods write `mods = [ { modId = ... } ]`** (an inline-table array), not
  `[[mods]]`. `data_io/mod_metadata.cjs` reads both; a reader that misses it sees a jar with no mods.
- **CurseForge publishes no file hash without an API key.** The lock checks the site API's file length and,
  when the CDN ETag is a plain MD5 (69 of 100 files on 2026-10-29), that MD5. Multipart ETags give length
  only. Bytes come from the site's own download redirect, never a constructed CDN URL.
- **Do not `require()` a CLI to check it loads.** `server_smoke/smoke.cjs` (and other entry points) run
  `main()` on load. A load check started a real Forge install on 2026-10-29. Use the tests.
- **`runtime.json` is the authority for reuse.** Bases, stages, run servers and cached worlds without the
  matching stamp are rebuilt or refused. The first run after this change reinstalls the Forge base under
  `loader-base/forge-1.20.1-47.4.10` and rebuilds `pack-test/stage/forge-1.20.1-47.4.10/server`, once.
- **The dedup cached-jar test reads Evil Eye Local's mods.** On 2026-10-29 Local lacked
  `hourglass-1.20-1.2.1.1.jar`, so `tools/analysis/dedup/tests/installed.test.cjs` failed with "Missing cached jar".
  That is an environment gap; relaunching Local installs the jar.

## NeoForge 1.21.1 first boots (2026-10-30)

- **Windows OpenSSH runs remote commands through cmd.exe** (8191-character line limit). A
  `-EncodedCommand` grows to about 2.7 times the script length, so long scripts are silently
  truncated and fail with nonsense parse errors. `remote/ssh.cjs` refuses anything over 8000 characters.
- **1.21 jars still ship 1.20 folders** (`loot_tables/`, `recipes/`, `tags/items`); the game ignores
  them. Most have a 1.21 twin in the same jar; the ones that do not are real missing content (MCA grave
  drops, Interiors recipes). The pack restores those under `kubejs/data` or reasons them in policy
  `ignoredLayout`, and the fast gate fails on anything else. A tag twin from another jar is not a restoration:
  tags merge, so the first jar's values are still missing (Macaw's BOP compat ships `mcwtrpdoors:` 1.21 tags).
- **A restored copy shadows a later upstream fix.** When a mod starts shipping its own 1.21 file, the
  `kubejs/data` copy still wins. After updating a jar, compare and delete restorations the jar now covers.
- **1.21 data carries its own load conditions** (`neoforge:conditions` on loot tables, data maps and
  recipes), and nested `minecraft:loot_table` entries name their table in `value`, not `name`.
- **A probe that makes Rhino reflect mod Item classes** (`stack.getItem()` on every creative-tab stack)
  logs RuntimeDistCleaner errors for client-only method signatures. Compare with `ItemStack.is(item)`.
- **HammerLib adds its tags in code from `config/hammerlib/tags/`**, keyed by `c:` names on 1.21.
  `forge:` keys are ignored, and the items keep their tags.
- **Mods rewrite configs on load** with their new keys and comments. Ship the write-back (LF, no
  trailing whitespace) rather than letting each instance rewrite the pack's copy every launch.

- **Mekanism recipe outputs are not all items.** Washing, dissolution, pigment, oxidizing and conversion
  recipes output chemicals (`{ id, amount }`, same shape as an item stack), and machine item outputs use
  `main_output`, `secondary_output` and `item_output`. The probe snapshots the `mekanism:chemical`
  registry; the recipe check counts those as `chemicalOutputs`.

- **Minecraft 1.21 `Commands.performPrefixedCommand` returns nothing.** A check reading `=== 1` from it always
  fails. Showcase checks read the result through the source's `CommandResultCallback`
  (`global.evilEyeShowcaseCheck.runCommand`, `h.run`), which also accepts Forge 1.20's integer return.
- **A command issued inside another command is only queued on 1.21.** The showcase's `/setblock` calls inside
  `/evileye showcase` ran after it returned, so every build refused at its first sign; construction now places
  blocks with `level.setBlock` and merges block-entity NBT itself. Queued commands also report into the outer
  source's result callback.
- **Showcase checks on 1.21 (first live run, 2026-10-30):** `forceload` takes effect on a later tick, and an
  entity summoned into a not-yet-loaded chunk is stored but invisible to `getEntities` (the harness now loads
  the area 20 ticks ahead); `saveWithFullMetadata` needs the registry provider; sign lines are saved as JSON
  strings; Mekanism machines refuse automated insertion at placement (prefill through their `items` NBT).
  Plots must be at least 24 x 22 x 6 for the shared hostile-terrain fixture. The storage fixture must physically power its hoppers during exact-count checks: setting
  `enabled=false` without redstone is undone by neighbour updates. The apparent missing diamond
  was in the output hopper (dk-54d65c18), with all 48 diamonds conserved.
- **Sable logs every reload** for physics entries naming unregistered blocks, and its loader ignores
  `neoforge:conditions`, so a gated `kubejs/data` override cannot silence one (boot 6).
- **Interstellaris gates crafting on research** (a `CraftingMenu` redirect on `setRecipeUsed`) and turns off
  Mekanism's teleporter recipes. A missing craft in a fresh world may be research, not a broken recipe.

## KubeJS 2101 (NeoForge migration branch)

- **Only startup scripts may set values on `global`.** A client or server script doing `global.x = ...`
  fails with "'global' cannot be assigned to in client or server scripts", and the error aborts the
  whole event handler even inside try/catch (observed 2026-10-30). `startup_scripts/globals.js` creates
  `global.emiCuration` and `global.evilEyeShowcase`, and everything else adds properties to those
  objects (allowed, observed live). The test-only probes and showcase checks inject their own
  `startup_*.js`, and the EMI test harness throws on a top-level `global` write.
- **Native listeners are reloadable** (`NativeEvents.onEvent(className, fn)`). Do not add once-per-launch
  guards. `NativeModEvents`/`ForgeModEvents` are gone, and mod-bus events also go through `NativeEvents`.
- **The class filter lives in the jar** (`kubejs.classfilter.txt`). `tools/analysis/emi_curation/tests/class_filter.test.cjs`
  reads it from the pinned KubeJS. `net.neoforged` is allowed, `net.neoforged.fml` denied.
- **1.21 stacks have components, not NBT.** Use the component patch (`getComponentsPatch`,
  EMI `getComponentChanges`); `getNbt()` does not exist. Classification-cache hits must still read
  the particular stack through the component-aware adapter, because variants share one registry key.
- **Do not compare raw Java references with JavaScript `==`/`===` in KubeJS 2101 hot paths.** Rhino's
  `shallowEq` calls `warnAboutNonJSObject`, including an expensive resource-bundle lookup even when no
  warning reaches the log. The 2026-10-31 walk JFR caught this pinning the client tick after curation.
  Use Java identity (`java_interop.sameRef`) when identity matters and truthiness for null readiness.
- **Read back Java collection fields after assigning them from KubeJS 2101.** Assigning the curated
  list to static `EmiStackList.filteredStacks` passes through Rhino's `Context.listOf`; the field can
  hold a new Java list rather than the supplied wrapper. Tracking the supplied reference made the
  session mistake its own installed view for a new EMI generation and rebuild forever. `indexView.install`
  returns the field value after assignment, and lifecycle code must retain that returned identity.

## Worktrees

- Move a linked worktree only with `git worktree move`. An Explorer move breaks the `.git` file link and the main repo's `worktrees/` record; `git worktree prune` would then delete the record.
- Local instance pre-launch commands hold the worktree's path: after `git worktree move`, update the `PreLaunchCommand` in that instance's `instance.cfg` (MultiMC closed).

## KubeJS 2001.6.5 / Rhino

- `ForgeEvents` is startup-only. Client scripts register with `MinecraftForge.EVENT_BUS.addListener(...)`.
- Forge listeners survive `/kubejs reload`. Register them once, behind a `global` flag, and dispatch through functions stored in `global` so reloaded code runs. `ClientEvents.*` handlers *are* replaced on reload.
- An uncaught exception in a Forge listener hard-crashes the client with **no crash report**. Wrap every listener, button callback and Java-interface callback in try/catch (`emi_curation/diagnostics.js`).
- Rhino cannot `Array.from` or `for...of` a Java collection. Use index loops (`collections.len`/`collections.at`) or `iterator()`.
- `instanceof` against a `Java.loadClass` class works. `.class` does not.
- Rhino turns a plain JS object into a Java interface proxy when it is assigned to an interface-typed field (used for `EmiRecipeManager`). Overloaded interface methods (`getRecipes()` / `getRecipes(category)`) all reach the same JS function, so branch on `undefined`.
- Every script in `client_scripts/` shares one scope. Top-level `const`s in different files collide, which is why each curation module is an IIFE that publishes onto `global.emiCuration`.
- KubeJS's script class filter denies `java.io`, `java.nio`, most of `java.lang`, `java.net` and `net.minecraftforge.fml`. A denied `Java.loadClass` fails only at runtime (the old REI script's `java.io.StringWriter` stack-trace path never worked). `tools/analysis/emi_curation/tests/class_filter.test.cjs` checks every class the curation scripts load.
- KubeJS wraps `CompoundTag` as a map view (`NativeJavaMap`) and NBT lists as list views. Key lookups return unwrapped values, and Java methods (`getId()`, `getAllKeys()`, `get(...)`) still resolve when no key of that name exists. `java_interop.toPlainNbt` relies on that.

## EMI internals (pinned 1.1.24+1.20.1+forge)

- `EmiStackList.filteredStacks` is rebuilt by `bakeFiltered()` on every EMI bake and on every user hide or unhide. The curation session detects this (the list identity changes) and re-applies CLEAN.
- `EmiRecipes.manager` is replaced twice per reload: first by a provisional manager, then by the sorted manager from a background worker. Install views only when `EmiReloadManager.isLoaded()` is true and `EmiRecipes.activeWorker == null`.
- An uncached curated index is a generation-scoped job, not one long tick: snapshot once, classify at
  most 256 stacks or 4 ms per tick, keep partial output private, validate the list/master references
  again before publication, then install and refresh once. A new EMI list, script reload, mark change or
  logout discards pending work; never publish a completed view from an old generation. Publication must
  retain the Java list reference read back from EMI, not the pre-assignment value Rhino may have copied.
- `JemiPlugin` skips JEI categories whose namespace has a native EMI plugin (`ae2`). AE2's JEI-only Certus Growth category is therefore not shown, and AE2's native EMI plugin uses info recipes instead.
- EMI rewrites `config/emi.css` in full on launch, so a test instance differs from the indexed file after the first start. EMI's QDCSS parser is regex-based: comments in `emi.css` must not contain `:`, `;`, `{` or `}` (guarded by `tools/analysis/emi_curation/tests/emi_config.test.cjs`).

- **Macaw's addons need their sibling Macaw mods.** `mcwbiomesoplenty` ships ~7,000 models whose parents live in `mcwfurnitures`, `mcwroofs`, `mcwstairs`, `mcwtrpdoors` and `mcwpaths` (plus bridges/doors/fences/windows). Without those mods its blocks register but render as the purple/black missing model, with no log error for the missing parents. The five are pinned as direct-URL Modrinth metafiles (no CurseForge ids looked up).

- **Widgets added at `ScreenEvent.Init.Post` are drawn under EMI's sidebar panels.** Anything that must float above EMI (the Mods dropdown) is drawn in `ScreenEvent.Render.Post` and hit-tested from `MouseButtonPressed.Pre`. Fills must be `flush()`ed before text, or the batched text can land under them.
- **`GuiGraphics.drawString` and `Font.width` are unusable from KubeJS 2001.6.5.** Their String/Component/FormattedCharSequence overloads are "ambiguous" by argument type (`InternalError: The choice of Java method GuiGraphics.m_280488_ ... is ambiguous`), and neither SRG names (`m_280488_`) nor explicit signatures (readable or SRG) resolve on these objects (`client.log`: "not found as any of ..."). Use single-overload methods instead: `GuiGraphics.drawWordWrap(Font, FormattedText, x, y, maxWidth, color)` (one method in 1.20.1, `m_280554_`, checked with `javap` on the Forge client jar) with `Component.literal(text)`, and estimate widths from vanilla's default font metrics. Colours are signed ARGB ints (`0xFFFFFFFF | 0`). Do not add a "stop drawing after one failure" switch: it makes the UI unusable.
- **`net.minecraftforge.fml.ModList` is denied by the class filter; use KubeJS's `Platform`.** `Platform.isLoaded(id)`, `Platform.getInfo(id).getName()` and `Platform.getList()` (checked with `javap` on `PlatformWrapper` in kubejs 2001.6.5) give the Forge mod list and display names. The Mods menu takes its entries from the index's item namespaces, so a datapack-only namespace never shows.
- **Tag membership is read with `BuiltInRegistries.ITEM/BLOCK.getTag(TagKey)`, then `isPresent()`, `get()`, `size()`, `get(i).value()`.** Do not iterate the `HolderSet` or call `getTagOrEmpty`: the iterator and list classes behind them can be JDK-internal (`ImmutableCollections`), whose reflective calls throw `IllegalAccessException` in Rhino (the same trap as the list copy in `java_interop`). Block tags map to items through `Block.asItem()` (wall signs return AIR, which is harmless). `Registry.getTag(TagKey)` returning `Optional<HolderSet.Named>` was checked with `javap` on the 1.20.1 jar, but the whole read has only run against the test fakes: the first in-game run is the real check (`decor tag <id>` errors in `client.log`).
- **The DECOR and Mods buttons settle beside CLEAN in one pass only because of listener order.** Forge listeners are added once per launch in script load order (`button.js` 50, `mods/mods_menu.js` 45, `decor_button.js` 44), so each frame places CLEAN, then Mods, then DECOR. Each widget publishes a live visible rect to `placement.register`; consumers read `placement.rect`/`rects`, never sibling widget holders. Keep that priority order; the registry does not change layout scheduling, and swapping it makes the buttons chase each other for a few frames. A window narrower than about 430 GUI pixels has no room for three buttons on the search row, and `placement.chooseRect` falls back (a button may overlap another).
- **Tooltips from the container and from EMI both pass `RenderTooltipEvent.Pre`** (EMI's `drawTooltip` invokes `GuiGraphics.renderTooltipInternal`). Cancel that event to suppress them under a custom overlay.
- **KubeJS 2001.6.5 loads `client_scripts` subfolders into one pack and sorts it by `// priority:` globally.** `emi_curation/ui/` can therefore hold scripts that must load between scripts in `emi_curation/` (checked in the jar: `KubeJS.loadScripts` walks the tree, `ScriptManager` sorts once, and `client.log` lists scripts as `emi_curation/<name>.js`). Keep priorities unique and descending in dependency order.

- **Dank button hints use exact screen names.** The pinned NeoForge Dank 20 jar contains
  `tfar.dankstorage.client.screens.DankStorageScreen`; the shipped IPN hint still names
  `CDankStorageScreen` and does not match it. The owned replacement geometry uses the current name:
  container-to-player is GUI right minus 89, player-to-container is GUI right minus 37 (positive
  horizontal offsets 72 and 20 mean leftward displacement). Runtime controls and pack cutover are
  not implemented yet; the existing shipped hint is unchanged. IPN's `buttonHints.*.hide` only hides
  the profile selector, not sort/move-all controls. Re-check the class after a Dank update.
- **IPN auto-refill indicators are separate from auto-refill.** IPN 2.2.5 draws a slot arrow when `AutoRefillSettings.auto_refill_enable_indicator_icons` or its misspelled hotbar counterpart `auto_refill_enable_horbar_indicator_icons` is enabled; CozyUI+ recolors that arrow purple. The pack sets both indicator flags to `false` while keeping `ModSettings.enable_auto_refill` `true`, so used-up hotbar stacks still restock without arrows on hotbar, inventory or armor slots. Preserve IPN's `horbar` spelling in the JSON key. IPN code confirms it: `AutoRefillSettings` defines both flags and `AutoRefillHandler` reads them to draw the icons.
- **Preserved configs ignore later pack changes (the purple arrows survived f104681).** `config/inventoryprofilesnext/inventoryprofiles.json` is `preserve = true`, so packwiz installs it only when missing; Trial's copy (written 2026-10-30) never received the indicator flags. Any new key for a `preserve` file, or for a config the mod generates itself, must go in `tools/packwiz/install/pack-owned-keys.json`: `install/install_pack.cjs` forces those keys after every sync (`tools/packwiz/install/pack_owned_keys.cjs`). Changing the shipped file alone does nothing for an existing install.
- **Flywheel 1.0 turns itself off under any Iris shaderpack, and rejects the 0.6 backend names.** `Backends` marks `flywheel:instancing`/`flywheel:indirect` unsupported while `isShaderPackInUse()`, so Create gears and belts render on the CPU through Iris vertex extension unless Iris Flywheel Compat is installed. Config values must be registry ids or `DEFAULT`, and with Iris Flywheel Compat it must be `DEFAULT` (or `irisflw:iris_instancing`): irisflw registers its own backend at priority 2000 and Flywheel's `chooseBackend` only falls back to lower priorities, so `flywheel:instancing` under a shaderpack logs `Flywheel backend fell back from 'flywheel:instancing' to 'flywheel:off'` and Create stays on the CPU path. Success is `IrisFLW backends initialized` with no fallback line. Unverified: irisflw's `accesstransformer.cfg` sits in `META-INF/` but its mods.toml points at the jar root (load ERROR in the log), so the `ShaderInstance.MODEL_VIEW_MATRIX` final-strip may not apply; `INSTANCING` logs `Backend with ID 'minecraft:INSTANCING' is not registered` and is ignored. Do not combine with Colorwheel (declared incompatible).
- **Selected hotbar slot draws no item: Amendments + an opaque-centre selection sprite.** Amendments' `GuiMixin` wraps `renderItemHotbar`'s selection `blitSprite` and draws it at z+270 (in front of items) unless `HotbarSelectionAnimation.selectionOnBackground` is set. That flag is read from the centre pixel of `hotbar_selection.png` inside the dynamic-asset generator, whose ResourceManager sees only vanilla files while `texture_pack_support = false`, so it always sees vanilla's transparent centre. CozyUI+'s selection sprite has an opaque centre in every frame (alpha 255), so the frame paints over the item. The pack sets `amendments-client.toml [misc] hotbar_slot_animation_speed = 0.0` (the wrapper then calls the vanilla draw), forced through `pack-owned-keys.json`. Cost: no sliding selector. Do not rely on `texture_pack_support`: a CACHED dynamic pack skips the generator and leaves the flag false.

- **Dank Recipe Transfer must be installed on both sides** (`side = "both"`). Dank Storage's client-side capability is empty, so the client cannot read a dock's contents by itself: the mod syncs the contents to the client. Without it on the server the button finds nothing; without it on the client there is no button.
- **Dank Recipe Transfer is pinned to mixin targets in JEI 15.62.0.219 and EMI 1.1.24.** Re-check it (and the pack-side smoke) after any JEI, EMI or Dank Storage update. It requires Dank Storage; JEI, EMI and Polymorph are optional.
- **Every rebuild of Dank Recipe Transfer changes the jar hash.** After publishing a new release, update `url`, `filename` and `hash` in `mods/dank-recipe-transfer.pw.toml`, then rehash and verify. A stale hash makes the installer refuse the download.

- **Smoke timeouts can be host CPU starvation, not the pack.** 2026-10-20 diagnosis: while the host was ~42% busy, Windows left the server JVM with threads Ready and none Running (~0.02 core); raising the JVM to High jumped it to ~5 cores and the boot finished (Done 36.5 s). No deadlock, no pack defect. The harness now boosts the JVM to AboveNormal, stops only when the log is silent and JVM CPU is flat, and labels low-CPU timeouts `HOST STARVED`. The two hangs below are probably this.
- **Server smoke can time out before "Preparing spawn area", with a fixed seed.** 2026-10-20, seed 20261020, same checkout: one boot spent 15+ min with the main thread busy in ModernFix `PackResourcesCacheEngine` (data pack resource cache) and never got to spawn prep; the next sat 30 min with the main thread parked and the log silent after "Built tags for registry minecraft:block". Neither reached Done, so the "random seed stalls worldgen" theory is not the whole story. The smoke labels a stall `STALL` only when the log shows "Preparing spawn area" progress; earlier hangs stay `FAIL (timeout)` and the thread dump in `stall-threads.txt` in the run dir is the evidence. Open: dk-6dc6fb94.

- **Cozy-mods trial pins (2026-10-20, branch `trial-cozy-mods`):** Cozy's Improved Cats 2.0.0 requires Forge 47.4.26+ (pack is 47.4.10), so 1.3.0 is pinned. Hexalia (which clashed with Thirst Was Taken's `FoodData` mixin) and Enchanted: Witchcraft, with its StateObserver and SmartBrainLib dependencies, were removed from the trial on 2026-10-21, so that pin is moot. Benign boot errors from the new mods: Thirst loot tables name Brewin' and Chewin' / Farmer's Respite items (not shipped), Cozy Cafe's `menu/vinery/kelp_cider.json` is malformed JSON, and AstikorCarts Redux's mixin config has no `minVersion`. Companion needs Kiwi; Handcrafted needs Resourceful Lib; Refurbished Furniture needs Framework (CurseForge).

- **Cozy-mods trial UI (2026-10-20):** TipTheScales is removed on `trial-cozy-mods` only (Modern UI warns it duplicates its features; main keeps it). CozyUI+ is the `no-fonts` build so Modern UI's fonts show. CozyUI Ex 0.4 does not cover Cosmetic Armor Reworked or Curios (it covers Create, Cloth Config, Better Advancements, Chat Patches and others), so `resourcepacks/evil-eye-cozy-overrides/` (a folder pack, indexed file by file, listed after CozyUI+ in `options.txt` so it sits above it) re-themes `cosmeticarmorreworked:textures/gui/cosarmorinventory.png` (1024x1024, Cozy inventory plus a four-slot cosmetic row at the original slot positions, UVs stay 256-space) and recolors `curios:textures/gui/inventory.png` / `inventory_revamp.png` to the Cozy palette (256x256, geometry untouched, corners not rounded). New Hearts declares `pack_format 2`, which 1.20.1 lists as incompatible and drops from `options.txt`; 1.20.1 ignores `supported_formats`. Modern UI's own screens (Forge warning screen) draw CozyUI+ button textures stretched; unfixed.

- **A KubeJS key mapping must be registered by a startup script, and `JsonIO.readString` returns `"null"` for a missing file.** Forge accepts key mappings only from `RegisterKeyMappingsEvent` on the mod bus during startup, so `startup_scripts/emi_curation_keys.js` uses `ForgeModEvents.onEvent` (checked with `javap` on `ForgeEventWrapper`: it resolves a class name string and warns outside the startup manager) and shares the `KeyMapping` through `global`; creating one from a client script would never reach the Controls screen, and a change needs a full restart. It uses `KeyConflictContext.GUI` so the default D never clashes with walking right (checked: no EMI, JEI or vanilla GUI binding uses a plain D). KubeJS 2001.6.5 `JsonIO.readString(String)` goes through `UtilsJS.getPath` (game dir only, `KubeJS.verifyFilePath`) and `readJson` returns null for a missing file, so the text is `"null"`, not an exception; `JsonIO.write(Path, JsonObject)` overwrites, does not create folders and *deletes* the file for a null object. Write via `JsonIO.parseRaw(text)`. The toast (`SystemToast.addOrUpdate`) and `getHoveredStack` paths have only run against the test fakes: the first in-game use is the real check.

- **First-install key and resource-pack defaults only reach fresh instances.** Evil Eye Client (`options/defaults`, which replaced Default Options) sets a key from `config/defaultoptions/keybindings.txt` only where `options.txt` had no saved value for it at startup (the keymap still becomes the key's "Reset" default), and the `default_packs` of `config/evileye_client/resourcepacks.json` (which replaced Resource Pack Overrides) apply only when `options.txt` has no `resourcePacks`; `required` packs are added on every launch. Existing instances keep their old keys and packs until rebound by hand. Do not copy an old `options.txt` into a new instance if the new keymap is wanted. Keys not listed in `keybindings.txt` keep each mod's own default. Re-check the keymap for new collisions after adding a mod with keybinds (compare `key_` lines in a played instance's `options.txt`).

- **Create: Dragons Plus 1.11.9 generates its sandpaper polishing recipes with a thread race, so the pack ships them as static data instead.** Its runtime pack (`AddPackFindersEvent`) runs a `RecipeProvider` whose `DataProvider.saveStable` writes happen on `Util.backgroundExecutor()` threads, and every write ends in `DynamicPack.put` on Create's plain, unsynchronised `HashMap`. Concurrent `put`s lose entries at random (and a resize race loses dozens at once), so each game or server start loaded 256-270 of the 269 `create_dragons_plus:sandpaper_polishing/*` recipes (one boot lost 85: total recipes 23064 instead of 23147). Players saw random missing waxed-to-unwaxed, oxidized-to-clean and `polished_X`-to-`X` sanding recipes. Nothing else varied across nine boots. Fix (2026-10-23): `config/create_dragons_plus-common.toml` turns off all three `recipe/sand_paper_polishing/*` generators and `kubejs/data/create_dragons_plus/recipes/sandpaper_polishing/**` holds the 269 recipes under the same ids. Consequence: a mod that adds waxed/oxidized/`polished_` blocks later gets no automatic sanding recipe; add its JSON beside the others (`machines.json` min 270 will flag a drop). To refresh, set the three keys back to `true` for a few boots and take the union of the loaded `create_dragons_plus:sandpaper_polishing/*` recipes from the pack-test `recipes.json` probe.

- **Create: Storage Drawers Compat 1.1.0 needs an unsided drawer item handler.** Storage Drawers 12.15.0 returned null for the unsided Forge capability: placed sided access worked, but real bearing contraptions had no mounted storage. The pack pins 12.15.1, which fixes that interface. An isolated headless probe verified real assembly, automatic PSI docking, insertion/extraction and restoration for standard, two-slot and compacting drawers, including conversion. Client rendering and drill/harvester collection remain unverified.
- **Create: Storage Drawers Compat 1.1.0 has a global client renderer mixin.** `BlockEntityDrawersRendererMixin` returns false for `playerBehindBlock` and zero for the player-distance check without testing whether the drawer is mounted. This restores contraption icons but also changes those checks for stationary drawers. Its author tested Storage Drawers 12.14.3; the pack uses 12.15.1 within the declared `[12.0.0,13.0.0)` range. Headless tests do not verify client rendering.

- Brigadier rejects trailing text after a finished literal/word argument (`/evileye showcase x ` gave "Incorrect argument for command"), and a bare node without `.executes` says "Unknown or incomplete command". The showcase command therefore takes one greedy string and parses it in script.

- **Private migration pins need an installer wrapper.** The cached packwiz installer rejects
  `file:///` download URLs and does not recognize `metadata:local`; copying jars beside those
  metafiles is insufficient. The owner Trial script instead indexes verified cached jars as
  ordinary files in a temporary local pack, so packwiz copies and tracks them without a host.
  Its prelaunch must keep using `scripts/migration/trial-walkthrough.ps1`; the raw checkout
  metadata is not installer-compatible. Pack-test/server-smoke retain the loopback overlay.
  Missing or changed cache bytes fail before installation.

## Ice and Fire CE config format

CE 2.1.4 uses Jupiter JSON (`config/iceandfire/iaf-common.json`, `iaf-client.json`), not
the Forge `iceandfire-*.toml`. Restoring only the TOML silently leaves CE defaults active,
including griefing. First boot logs missing-config errors before writing defaults; ship the
reconciled JSON plus `config/jupiter.json`. Legacy biome JSON filters also have no CE reader;
CE uses biome tags and structure sets. Do not convert an old 1/N per-chunk spawn rate into
a CE per-structure-candidate probability without accounting for spacing (dk-e7b276f4).

- **Planet terrain loaded does not mean entity sections are ready.** A height lookup can load
  moon terrain while the asynchronous destination tracker is still catching up. The showcase
  now waits on `ServerLevel.isPositionEntityTicking(BlockPos)` before teleporting (up to 200
  ticks), then retains its exact arrival assertion. Integration evidence: the failed run saved
  the traveller in the correct moon region at (8.5, 93, 8.5); the readiness run passes all 1279
  assertions (`jobs/2026-10-30-iaf-integration/showcase-all-ready`).

- **Resource-pack ids differ between Forge and NeoForge.** NeoForge names a mod's built-in pack
  `mod/<namespace>:<path>` (Town Talk is `mod/towntalk:respack`, not Forge's `builtin/towntalk`), and a pack
  file's id is its exact installed file name (`file/Eat Quiet 1.0.0_1.20-1.21.zip` on the migration branch). A
  stale id is silently skipped; the pack contract test checks every id in `config/evileye_client/resourcepacks.json`.

- **Ender IO machine screens + EMI (fixed in Evil Eye Client 0.3.6).** Ender Core's `EnderContainerScreen.renderLabels`
  leaks a z translation into `ContainerScreenEvent.Render.Foreground`, which put EMI's item list over EMI's own tooltip
  (drawn later in `ScreenEvent.Render.Post`); and EMI 1.1.24's JEI bridge (`dev.emi.emi.jemi.JemiRecipeHandler`) placed every
  transfer-highlight slot at 0,0 (identity `==` lookup), so JEI-provided recipes' (Ender IO machines) missing-ingredient
  highlights drew in the recipe's top-left corner. Both are patched in the Client jar; drop the mixin when EMI fixes the lookup.
