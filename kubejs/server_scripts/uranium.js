// Uranium compatibility recipes; keep the native KubeJS cooking defaults.
ServerEvents.recipes(function (event) {
  // Alex's Caves uranium remains biome-specific, but can fuel Extreme Reactors.
  event.smelting('bigreactors:yellorium_ingot', 'alexscaves:uranium').id('kubejs:uranium_ingot')
  event.blasting('bigreactors:yellorium_ingot', 'alexscaves:uranium').id('kubejs:uranium_ingot_blasting')
  // Create's compat crushed uranium otherwise loses its smelting target with ATO gone.
  event.smelting('bigreactors:yellorium_ingot', 'create:crushed_raw_uranium').id('kubejs:crushed_uranium_ingot')
  event.blasting('bigreactors:yellorium_ingot', 'create:crushed_raw_uranium').id('kubejs:crushed_uranium_ingot_blasting')
})
