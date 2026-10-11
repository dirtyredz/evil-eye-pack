# EMI trial: recipe-viewer coverage evidence

Evidence for the `emi-trial` branch. It comes from reading the jars as data: their
`META-INF/mods.toml` and class constant pools. No game was launched. "Bridge" means
expected coverage through installed JEI plus EMI's JEMI bridge. It is **not** an in-game
pass. The **In-game result** column is for the owner's checklist in
[emi-trial.md](emi-trial.md).

Reproduce with:

```
node tools/emi_coverage/scan_jars.cjs "<instance>/.minecraft/mods" emi.jar jei.jar jep.jar
```

The scan reads every top-level jar and every nested jar (`META-INF/jarjar/*.jar`,
`META-INF/jars/*.jar`, up to three levels deep). It reports classes whose constant pool
names `Lmezz/jei/api/JeiPlugin;`, `Ldev/emi/emi/api/EmiEntrypoint;` or
`Lme/shedaniel/rei/forge/REIPlugin*`. Those are the annotations each viewer uses to
discover plugins on Forge. It also reports viewer dependencies declared in `mods.toml`.

## Added jars (downloaded 2026-10-11, hashes verified)

| Mod | File | Source | Hash (as in the metafile) | Size |
|---|---|---|---|---|
| EMI 1.1.24+1.20.1+forge | `emi-1.1.24+1.20.1+forge.jar` | Modrinth `fRiHVvU7` / `Axuu9I9R` | sha512 `02743be3…a43229c8b` (sha1 `ea320200…3671520a`) | 1,121,750 |
| JEI 15.20.0.102 | `jei-1.20.1-forge-15.20.0.102.jar` | CurseForge `238222` / file `5781188` | sha1 `543a832c1c09bd78e41732f5a94eec3383b223bb` | 1,406,026 |
| JEP 3.0.1 | `JustEnoughProfessions-forge-1.20.1-3.0.1.jar` | Modrinth `kB56GtWA` / `ANKVJC3T` | sha512 `b1637b0c…e88a94d80e` (sha1 `dd8b3252…cf0bd06f`) | 24,607 |

- The JEI CurseForge file size (1,406,026) and sha1 match Modrinth's copy of the same
  release (`MybRLD9h`). The jar bytes downloaded from `mediafilez.forgecdn.net` hash to
  that sha1.
- Compatibility, from each jar's `mods.toml`:
  - EMI declares `loaderVersion [40,)`. Its JEI dependency is optional: `jei [15.20.0.0,)`, ordering BEFORE, client side.
  - JEI requires `forge [47.0,)` and `minecraft [1.20.1, 1.20.2)`.
  - JEP requires `jei [15.0.0.12,)`, `forge [47.0.1,)` and `minecraft [1.20.1,1.21)`.
  - All three accept Forge 47.4.10 on Minecraft 1.20.1.
- The plugin entry points are present:
  - EMI: `dev.emi.emi.VanillaPlugin` (native) and `dev.emi.emi.jemi.JemiPlugin` (a JEI plugin, the JEMI bridge).
  - JEI: five internal plugins.
  - JEP: `com.mrbysco.justenoughprofessions.ForgeProfessionPlugin`.

## Removed jars

| Metafile | Jar | Why |
|---|---|---|
| `roughly-enough-items.pw.toml` | REI 12.1.785 | replaced by EMI |
| `roughly-enough-items-hacks.pw.toml` | REI Plugin Compatibilities 12.0.93 | requires REI. Its `mods.toml` **also declares mod id `jei`**, so it would compete with the real JEI runtime. |
| `roughly-enough-professions-rep.pw.toml` | REP 2.0.2 (`REPClientPlugin`, REI-only) | requires REI. Replaced by JEP. |

No other jar or nested jar declares a required dependency on `roughlyenoughitems`,
`rei_plugin_compatibilities` or `roughlyenoughprofessions`. No nested jar declares mod id
`jei` or carries any viewer plugin. The instance has 159 top-level jars. 42 nested jars
were inspected: MixinExtras, Registrate, GeckoLib, mclib, Flywheel, xaerolib,
productivelib, spectrelib, diagonalblocks, kuma_api, create_dragon_lib, kotlinforforge
parts, and others.

## Plugin registrations found (installed instance)

| Mod (jar) | EMI native | JEI plugin | REI plugin | Covered under trial? | In-game result |
|---|---|---|---|---|---|
| AE2 15.4.10 | `appeng.integration.modules.emi.AppEngEmiPlugin` | `appeng.integration.modules.jei.JEIPlugin` | `ReiPlugin` | Native EMI. JEMI skips the `ae2` namespace (see AE2 below). | |
| Almost Unified 0.11.0 | `AlmostEMI` | `AlmostJEI` | `AlmostREIForge` | Native EMI | |
| Alex's Caves 2.0.2 | | `AlexsCavesPlugin` | | Bridge | |
| Alex's Mobs 1.22.9 | | `AlexMobsJEIPlugin` | | Bridge | |
| AllTheCompressed 3.0.2 | | `JEICompat` | | Bridge | |
| Ars Elemental 0.6.4.1 | | `JeiArsExtraPlugin` | | Bridge | |
| Ars Nouveau 4.9.0 | | `JEIArsNouveauPlugin` | | Bridge | |
| Create 0.5.1.j | | `CreateJEI` | | Bridge | |
| Create Crafts & Additions 1.2.5 | | `CreateAdditionJEI` | | Bridge | |
| Create Enchantment Industry 1.2.9.d | | `CeiJEIPlugin` | | Bridge | |
| Curios 5.14.1 | | `CuriosJeiPlugin` | | Bridge. Check the UI. | |
| Domum Ornamentum 1.0.154 | | `JEIPlugin` | | Bridge | |
| Ender IO 6.0.23 | | `EnderIOJEI`, `MachinesJEI` | | Bridge. Check machines and NBT variants. | |
| Extreme Reactors 2.0.84 | | `ExtremeReactorsJeiPlugin` | | Bridge | |
| FTB Library 2001.1.5 | | `JEIIntegration` | `REIForgePluginStub` | Bridge. The REI favorites integration is gone (see below). | |
| Fusion 6.0.0.3 | | `JEIFusionPlugin` | | Bridge | |
| HammerLib 20.1.50 | | `JeiHammerLib` | | Bridge | |
| HammerMicroblocks 20.1.13 | | `JEIHammerMicroblocks` | | Bridge | |
| Ice and Fire 2.1.13 | | `IceAndFireJEIPlugin` | | Bridge | |
| Iron Furnaces 4.1.8 | | `IronFurnacesJEIPlugin` | | Bridge | |
| Jade 11.13.3 | | `JEICompat` | | Bridge. Verify tooltips. | |
| KubeJS 2001.6.5 | | `integration.forge.jei.JEIPlugin` | `REIForgePluginStub` | Bridge. The curation scripts use Java interop, not a plugin. | |
| L_Ender's Cataclysm 1.28 | | `LEnderCataclysmJEIPlugin` | | Bridge | |
| McJtyLib 8.0.8 | | `JeiCompatibility` | | Bridge (RFTools helpers) | |
| MineColonies 1.1.452 | | `core.compatibility.jei.JEIPlugin` | | Bridge. Check worker categories. | |
| ModernFix 5.27.83 | | `JEIRuntimeCapturer` | | Runtime hook, not recipes | |
| Patchouli 85 | | `PatchouliJeiPlugin` | | Bridge | |
| Polymorph 0.49.11 | | `PolymorphJeiPlugin` | | Bridge. Test recipe choice and transfer. | |
| Productive Bees 12.6.0 | | `ProductiveBeesJeiPlugin` | | Bridge. Check bee subtypes and categories. | |
| RFTools Base 5.0.7 | | `RFToolsBaseJeiPlugin` | | Bridge | |
| RFTools Control 7.0.4 | | `RFToolsControlJeiPlugin` | | Bridge | |
| RFTools Dimensions 11.0.11 | | `compat.JeiCompatibility` | | Bridge. Verify dimlets. | |
| RFTools Utility 6.0.7 | | `RFToolsUtilityJeiPlugin` | | Bridge | |
| Steam 'n' Rails 1.7.3 | | `RailwaysJeiPlugin` | | Bridge | |
| Stylish Effects 8.0.4 | | `StylishEffectsJeiPlugin` | `ForgeStylishEffectsReiPlugin` | JEI path. Verify the screen exclusions. | |
| Supplementaries 2.5.21 | | `JEICompat` | `REICompat` | JEI path | |
| ZeroCore 2.1.45 | | `ZeroCoreJeiPlugin` | | Bridge | |
| JEP 3.0.1 (new) | | `ForgeProfessionPlugin` | | Bridge. Replaces REP. | |

The plan expected two more. **CyclopsCore 1.22.3** and **SimpleCoreLib 6.0.1.2** have no
`@JeiPlugin` class. They carry only JEI helper code that their consumer mods call. All
other mods have no viewer plugin. Their ordinary vanilla-type recipes still show through
EMI's `VanillaPlugin`, but having no plugin does not prove complete coverage.

## Native EMI category parity (JEMI skips handled namespaces)

`JemiPlugin` (EMI 1.1.24) skips every JEI category whose namespace belongs to a mod that
ships a native EMI plugin. Here that means `ae2`, `almostunified` and `emi`.

- **AE2.**
  - JEI categories: Attunement, **Certus Growth**, Charger, Condenser, Entropy Manipulator, Inscriber, Transform, and facades.
  - Native EMI plugin: Charger, Condenser, Entropy, Inscriber, Transform, P2P attunement, a facade generator, and `EmiInfoRecipe` descriptions (`addDescription`).
  - Certus Growth has **no native EMI category**. AE2 appears to show crystal growth as info/description recipes instead.
  - This is the one known category difference. It is explained, but it must be checked in game. If growth information is missing, it counts as a recipe-coverage loss for acceptance.
- **Almost Unified.** Its EMI plugin only hides or unifies entries, so no categories are expected.

## Curation evidence (Ender IO Zombie exceptions)

`com.enderio.api.capability.StoredEntityData.of(ResourceLocation)` builds `{id:"<entity>"}`.
`serializeNBT()` writes `Entity` and adds `MaxHealth` only when it is above 0, which it is
not for `of(...)`. `EntityStorageItemStack.setStoredEntityData` stores the result under
`BlockEntityTag.EntityStorage`. `SoulVialItem.setEntityType` and
`BrokenSpawnerItem.forType` both go through that capability. So the canonical Zombie stack
of both items carries exactly:

```
{BlockEntityTag:{EntityStorage:{Entity:{id:"minecraft:zombie"}}}}
```

`config/emi-curation/rules.json` keeps exactly that NBT, compared structurally. Any
extra tag (MaxHealth, Health, display) does not match.

## REI display-filter rule (source of the CLEAN recipe filter)

REI 12.1.785 `me.shedaniel.rei.plugin.client.runtime.FilteredStacksVisibilityHandler`
(read with `javap`) works like this:

- When `shouldFilterDisplays` is on, it checks each non-empty input `EntryIngredient`, then each output.
- A display is hidden as soon as one ingredient has *all* of its entries filtered by the configured filtering rules: manual, basic (plugin), hidden-from-recipe-viewers and search rules.
- Catalysts are not examined.

`kubejs/client_scripts/emi_curation/policy.js` `isDisplayHidden` implements this rule.

## Actual verification outcomes

| Check | Result |
|---|---|
| Jar hashes vs metafiles (`verify_hashes.cjs --jars`) | pass (3 jars) |
| Minecraft, loader and dependency ranges | pass (see above) |
| Plugin entry points present | pass |
| No remaining required REI dependency, no competing JEI runtime | pass |
| In-game coverage | pending: owner checklist |
