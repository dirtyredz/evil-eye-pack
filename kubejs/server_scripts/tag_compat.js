// Tag aliases for mods that still name pre-1.21 common tags.
// Create: Interiors 0.6.1 recolours chairs with #c:<colour>_dyes (the old Fabric spelling); NeoForge 1.21.1
// ships #c:dyes/<colour>, so without these aliases all 32 chair and floor-chair recolour recipes are empty.
ServerEvents.tags('item', function (event) {
  ;['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black']
    .forEach(function (colour) { event.add('c:' + colour + '_dyes', '#c:dyes/' + colour) })
})
