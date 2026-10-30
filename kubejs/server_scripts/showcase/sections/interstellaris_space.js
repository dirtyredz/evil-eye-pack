// priority: 20
// Interstellaris and Sable: the new metals and planet surfaces, plus a floating pad for Sable physics.
;(function () {
  var ns = global.evilEyeShowcase
  ns.register('interstellaris_space', function () {
    var p = ns.plan(16, 14, 8)
    p.label(1, 1, ['INTERSTELLARIS', 'Space + Sable', 'Walk south ->', 'Read each label'])
    p.block(0, 0, 0, 'minecraft:light[level=15]')
    // New metals: ores in the overworld, metal blocks from them.
    var ores = ['titanium', 'platinum', 'silver', 'tungsten']
    for (var i = 0; i < ores.length; i++) {
      p.block(1 + i * 2, 0, 4, 'interstellaris:' + ores[i] + '_ore')
      p.block(1 + i * 2, 1, 4, 'interstellaris:' + ores[i] + '_block')
    }
    p.label(9, 4, ['NEW METALS', 'Ore below, block on top', 'Ti Pt Ag W', 'Textures OK?'])
    // Planet surfaces players reach by rocket.
    var ground = ['lunar_regolith', 'martian_regolith', 'venusian_regolith', 'enceladean_ice']
    for (var g = 0; g < ground.length; g++) p.block(1 + g * 2, 0, 7, 'interstellaris:' + ground[g])
    p.label(9, 7, ['PLANET GROUND', 'Moon Mars Venus', 'Enceladus', 'Fly there by rocket'])
    // Sable: a 3x3 iron pad floating four blocks up. Assembling it makes a physics sub-level that falls.
    for (var x = 11; x <= 13; x++) for (var z = 10; z <= 12; z++) p.block(x, 4, z, 'minecraft:iron_block')
    p.label(9, 11, ['SABLE PHYSICS', 'Floating iron pad', '/sable assemble area', 'on its corners: drops'])
    return p
  })
})();
