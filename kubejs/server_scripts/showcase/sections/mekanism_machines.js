// priority: 20
// Mekanism: power generation, cable transport and ore processing, with the pack's dust survivors.
;(function () {
  var ns = global.evilEyeShowcase
  // A creative cube placed by command starts empty; this fills it (Mekanism's energy_containers record).
  var FULL = '{energy_containers:[{container:0b,stored:9223372036854775807L}]}'
  ns.register('mekanism_machines', function () {
    var p = ns.plan(16, 12, 5)
    p.label(1, 1, ['MEKANISM', 'Power + processing', 'Walk south ->', 'Read each label'])
    p.block(0, 0, 0, 'minecraft:light[level=15]')
    // Transport: the creative cube's front (east) feeds one cable line along the machines' backs.
    p.block(1, 0, 5, 'mekanism:creative_energy_cube[facing=east]', FULL)
    for (var x = 2; x <= 9; x++) p.block(x, 0, 5, 'mekanism:basic_universal_cable')
    p.label(1, 7, ['CREATIVE CUBE', 'Front = output', 'Cable runs east', 'Cable glows?'])
    // Production: ore doubling and ingot crushing both end in the Ender IO dust (dedup survivor).
    p.sample(3, 4, 'mekanism:enrichment_chamber[facing=north,active=false]', [['minecraft:iron_ore', 16]], ['ENRICHMENT', '16 iron ore in', '-> 32 iron dust', 'Ender IO dust?'])
    p.sample(7, 4, 'mekanism:crusher[facing=north,active=false]', [['minecraft:iron_ingot', 16]], ['CRUSHER', '16 iron ingots in', '-> 16 iron dust', 'Ender IO dust?'])
    // Generation: a heat generator burning coal, on its own.
    p.sample(12, 4, 'mekanismgenerators:heat_generator[facing=north,active=false]', [['minecraft:coal', 32]], ['HEAT GENERATOR', '32 coal fuel', 'Charges itself', 'Flames on front?'])
    p.label(12, 9, ['NOT SHOWN', 'Fission / turbines', 'need multiblocks', 'build in survival'])
    return p
  })
})();
