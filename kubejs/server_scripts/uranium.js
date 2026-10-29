// Uranium compatibility recipes; keep the native KubeJS cooking defaults.
// Alex's Caves' uranium -> yellorium recipes are suspended while its NeoForge port is pending; the
// original script is kept in tools/packwiz/migration/deferred/alexscaves/ and returns with the port.
ServerEvents.recipes(function (event) {
  // Create's compat crushed uranium otherwise loses its smelting target with ATO gone.
  event.smelting('bigreactors:yellorium_ingot', 'create:crushed_raw_uranium').id('kubejs:crushed_uranium_ingot')
  event.blasting('bigreactors:yellorium_ingot', 'create:crushed_raw_uranium').id('kubejs:crushed_uranium_ingot_blasting')
})
