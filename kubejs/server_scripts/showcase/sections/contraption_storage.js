// priority: 20
;(function () {
  var ns = global.evilEyeShowcase
  ns.register('contraption_storage', function () {
    var p = ns.plan(24, 53, 8)
    p.label(2, 1, ['CONTRAPTION', 'STORAGE LAB', 'Walk south ->', 'Read each label'])
    p.label(7, 1, ['DRAWER FRONTS', 'Stand on gold', 'Icons / counts?', 'Walk away: fade?'])
    p.label(12, 1, ['MOVING STORAGE', 'Lever OFF = stop', 'Lever ON = run', '2 RPM bearing'])
    for (var g = 0; g < 4; g++) p.block(2 + g * 5, -1, 0, 'minecraft:gold_block')
    p.block(0, 0, 0, 'minecraft:light[level=15]')
    var rows = [8, 24, 48]
    for (var r = 0; r < rows.length; r++) {
      var z = rows[r], distance = z + 'm from gold'
      p.sample(2, z, 'storagedrawers:oak_full_drawers_1[facing=north]', [['minecraft:diamond', 64]], ['1-slot drawer', distance, 'Diamond: 64', 'Icons / counts?'])
      p.sample(7, z, 'storagedrawers:oak_full_drawers_2[facing=north]', [['minecraft:diamond', 32], ['minecraft:emerald', 48]], ['2-slot drawer', distance, 'Diamond / emerald', 'Both fronts?'])
      p.sample(12, z, 'storagedrawers:oak_full_drawers_4[facing=north]', [['minecraft:diamond', 16], ['minecraft:emerald', 24], ['minecraft:redstone', 32], ['minecraft:lapis_lazuli', 48]], ['4-slot drawer', distance, 'Four item types', 'All fronts?'])
      p.sample(17, z, 'storagedrawers:compacting_drawers_3[facing=north]', [['minecraft:iron_ingot', 18]], ['Compacting iron', distance, '2 blocks / 18 ingots', '/ 162 nuggets'])
    }
    // Shared motor controls read the lever; the motor itself starts at zero RPM.
    p.block(8, 0, 16, 'create:creative_motor[facing=up]')
    p.motors.push({ x: 8, y: 0, z: 16, speed: 2, lever: [7, 1, 16] })
    p.block(8, 1, 16, 'create:shaft[axis=y]')
    p.block(8, 2, 16, 'create:mechanical_bearing[facing=up]')
    p.bearings.push([8, 2, 16])
    p.block(7, 0, 16, 'minecraft:andesite')
    p.block(7, 1, 16, 'minecraft:lever[face=floor,facing=north,powered=false]')
    p.block(8, 3, 16, 'minecraft:andesite')
    p.block(9, 3, 16, 'storagedrawers:oak_full_drawers_1[facing=north]')
    p.block(10, 3, 16, 'storagedrawers:compacting_drawers_3[facing=north]')
    p.block(11, 3, 16, 'ironchest:iron_chest[facing=north]')
    p.block(12, 3, 16, 'create:portable_storage_interface[facing=east]')
    p.fills.push({ x: 9, y: 3, z: 16, items: [['minecraft:diamond', 32]] })
    p.fills.push({ x: 10, y: 3, z: 16, items: [['minecraft:iron_ingot', 18]] })
    p.fills.push({ x: 11, y: 3, z: 16, items: [['minecraft:emerald', 32]] })
    p.glue.push([8, 3, 16, 13, 4, 17])
    p.block(14, 3, 16, 'create:portable_storage_interface[facing=west]')
    p.block(14, 4, 16, 'minecraft:hopper[facing=down]')
    p.block(14, 5, 16, 'minecraft:chest[facing=north]')
    p.fills.push({ x: 14, y: 5, z: 16, items: [['minecraft:diamond', 16], ['minecraft:iron_ingot', 18], ['minecraft:emerald', 16]] })
    p.block(14, 2, 16, 'minecraft:hopper[facing=down]')
    p.block(14, 1, 16, 'minecraft:chest[facing=north]')
    p.label(4, 13, ['BEARING PAYLOAD', 'Flip lever to run', 'Fronts while moving?', 'Right-click stores'])
    p.label(16, 16, ['PSI DOCK', 'Input chest above', 'Output chest below', 'Watch both hoppers'])
    p.label(16, 19, ['TRANSFER CHECK', 'Gems + iron enter', 'Items exit to chest', 'Pauses when docked'])
    p.label(4, 21, ['MOVING MENUS', 'Drawer + iron chest', 'Open while rotating', 'Check stored items'])
    // Two steps put the viewer at payload height without entering its swept volume.
    for (var x = 6; x <= 12; x++) {
      p.block(x, 0, 10, 'minecraft:stone_brick_stairs[facing=south]')
      p.block(x, 0, 11, 'minecraft:stone_bricks')
      p.block(x, 1, 11, 'minecraft:stone_brick_slab[type=bottom]')
    }
    // Storage Drawers' quantify key persists this flag; counts would otherwise be hidden.
    p.blocks.forEach(function (b) { if (b.state.indexOf('storagedrawers:') === 0) b.nbt = '{Qua:1b}' })
    return p
  })
})();
