// Uranium compatibility recipes; keep the native KubeJS cooking defaults.
// Create's crushed-uranium smelting is no longer here: with Mekanism (2026-10-30) Create's own Mekanism-gated
// compat recipes load and the dedup overrides point them at yellorium.
ServerEvents.recipes(function (event) {
  // Alex's Caves uranium remains biome-specific, but can fuel Extreme Reactors.
  event.smelting('bigreactors:yellorium_ingot', 'alexscaves:uranium').id('kubejs:uranium_ingot')
  event.blasting('bigreactors:yellorium_ingot', 'alexscaves:uranium').id('kubejs:uranium_ingot_blasting')
})
