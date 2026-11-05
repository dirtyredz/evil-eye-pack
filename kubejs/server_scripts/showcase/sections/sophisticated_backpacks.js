// priority: 20
// Sophisticated Backpacks (+ Core, + Create Integration): labelled pads for the owner's "one large backpack
// worn in the Curios back slot" plan. The screens, the worn rendering and the mounted backpack on a Create
// contraption are client or player behaviour, so the signs say what to try; the check confirms the server side.
// Static: no rig. Dank Storage stays, so a chest of Dank units sits beside the backpacks for comparison.
;(function () {
  var ns = global.evilEyeShowcase
  var SB = 'sophisticatedbackpacks:'
  ns.register('sophisticated_backpacks', function () {
    // At least 24 x 22: the shared hostile-terrain check builds hills, water and fences up to there.
    var p = ns.plan(24, 22, 6)
    p.label(1, 1, ['SOPHISTICATED', 'BACKPACKS', 'Wear one in the', 'Curios back slot'])
    p.block(0, 0, 0, 'minecraft:light[level=15]')
    p.sample(2, 5, 'minecraft:chest[facing=south]', [
      [SB + 'backpack', 1], [SB + 'copper_backpack', 1], [SB + 'iron_backpack', 1],
      [SB + 'gold_backpack', 1], [SB + 'diamond_backpack', 1], [SB + 'netherite_backpack', 1]
    ], ['ALL SIX TIERS', 'Open G: Curios', 'slot "Back"', 'B opens it worn'])
    p.sample(2, 8, 'minecraft:chest[facing=south]', [
      [SB + 'pickup_upgrade', 1], [SB + 'magnet_upgrade', 1], [SB + 'restock_upgrade', 1],
      [SB + 'void_upgrade', 1], [SB + 'crafting_upgrade', 1], [SB + 'stack_upgrade_tier_1', 4]
    ], ['UPGRADES', 'Put in the', "backpack's left", 'upgrade panel'])
    p.sample(2, 11, 'minecraft:chest[facing=south]', [
      ['dankstorage:dank_1', 1], ['dankstorage:dank_3', 1], ['dankstorage:dank_7', 1]
    ], ['DANK STORAGE', 'stays: compare', 'one backpack vs', 'many Dank units'])
    p.block(12, 0, 5, SB + 'iron_backpack[facing=north]')
    p.label(14, 5, ['PLACED BACKPACK', 'Right-click to', 'open; sneak-click', 'picks it back up'])
    p.block(12, 0, 8, 'create:mechanical_bearing[facing=up]')
    p.block(12, 1, 8, SB + 'copper_backpack[facing=north]')
    p.label(14, 8, ['CREATE: click the', 'bearing to assemble', 'then open the', 'mounted backpack'])
    return p
  })
})();
