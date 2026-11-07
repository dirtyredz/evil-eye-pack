// priority: 20
// Evil Eye equipment panel (Client 0.4.0 + Tweaks 0.7.0, storage tabs 0.12.0, trash and action rail 0.13.0, recipe fill 0.14.0, backpack controls 0.15.0, replaces Cosmetic Armor Reworked): labelled pads
// naming what the panel holds. The panel is a client screen, so the labels tell the owner what to look for.
// Static: no rig, no inventories.
;(function () {
  var ns = global.evilEyeShowcase
  ns.register('evileye_equipment', function () {
    // At least 24 x 22: the shared hostile-terrain check builds hills, water and fences up to there.
    var p = ns.plan(24, 22, 6)
    p.label(1, 1, ['EQUIPMENT', 'PANEL', 'Replaces Cosmetic', 'Armor Reworked'])
    p.block(0, 0, 0, 'minecraft:light[level=15]')
    p.block(2, 0, 5, 'minecraft:lectern[facing=south]')
    p.label(4, 5, ['OPEN THE PANEL', 'press G or the', "inventory's", 'Curios button'])
    p.block(2, 0, 8, 'minecraft:ender_chest[facing=north]')
    p.label(4, 8, ['LEFT: equipped', 'curios', 'RIGHT: cosmetic', 'curios'])
    p.block(2, 0, 11, 'minecraft:smithing_table')
    p.label(4, 11, ['ARMOUR beside', 'the model', 'COSMETIC ARMOUR', 'opposite'])
    p.block(12, 0, 5, 'minecraft:loom[facing=south]')
    p.label(14, 5, ['VISIBILITY...', 'button: Show', 'equipment / Show', 'skin'])
    p.block(12, 0, 8, 'minecraft:grindstone[face=floor,facing=north]')
    p.label(14, 8, ['COSMETIC ITEMS', 'stay stored if', 'display is off', '(keep on death: off)'])
    p.block(12, 0, 11, 'minecraft:barrel[facing=up]')
    p.label(14, 11, ['STORAGE TABS', 'Backpack and Ender', 'open inside the', 'panel (carry the item)'])
    p.block(2, 0, 14, 'minecraft:cauldron')
    p.label(4, 14, ['TRASH CAN', 'button, bottom-right', 'of the panel: 36', 'slots, destroyed on leave'])
    p.block(12, 0, 14, 'minecraft:hopper')
    p.label(14, 14, ['ACTION RAIL', 'sort / move-all /', 'transfer on Backpack', 'and Ender tabs'])
    p.block(2, 0, 17, 'minecraft:crafting_table')
    p.label(4, 17, ['RECIPE FILL', 'EMI + fills from the', 'carried backpack and', 'Ender Pouch'])
    p.block(12, 0, 17, 'minecraft:chest[facing=north]')
    p.label(14, 17, ['BACKPACK CONTROLS', 'upgrades + settings', 'right of inventory', 'on the Backpack tab'])
    return p
  })
})();
