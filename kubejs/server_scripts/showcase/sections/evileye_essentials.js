// priority: 20
// Evil Eye Essentials (wave 5, replaces FTB Essentials and FTB Library's sidebar): a walk-through of the
// commands players use, with the block each one is about. Static: no rig, no inventories.
;(function () {
  var ns = global.evilEyeShowcase
  ns.register('evileye_essentials', function () {
    // At least 24 x 22: the shared hostile-terrain check builds hills, water and fences up to there.
    var p = ns.plan(24, 22, 6)
    p.label(1, 1, ['EVIL EYE', 'ESSENTIALS', 'Replaces FTB', 'Walk south ->'])
    p.block(0, 0, 0, 'minecraft:light[level=15]')
    // Homes and /back: a bed-like pad to stand on while trying them.
    p.block(2, 0, 5, 'minecraft:lodestone')
    p.label(4, 5, ['HOMES (3 each)', '/sethome [name]', '/home  /delhome', '/listhomes'])
    p.block(2, 0, 8, 'minecraft:respawn_anchor[charges=4]')
    p.label(4, 8, ['BACK + SPAWN', '/back (60 s)', '/spawn', '/playerspawn'])
    p.block(2, 0, 11, 'minecraft:ender_chest[facing=north]')
    p.label(4, 11, ['TELEPORT ASK', '/tpa <player>', '/tpahere <player>', '/tpaccept /tpdeny'])
    p.block(2, 0, 14, 'minecraft:crying_obsidian')
    p.label(4, 14, ['WARPS', '/warp <name>', 'ops: /setwarp', '/listwarps'])
    // The inventory sidebar is client-side: the label tells the owner where to look.
    p.block(12, 0, 5, 'minecraft:cauldron')
    p.label(14, 5, ['TRASH CAN', '/trashcan or the', 'inventory sidebar', '(top-left button)'])
    p.block(12, 0, 8, 'minecraft:crafting_table')
    p.label(14, 8, ['OPERATORS', '/heal /feed /fly', '/god /invsee', '/open crafting'])
    p.block(12, 0, 11, 'minecraft:chest[facing=north]')
    p.label(14, 11, ['KITS + NAMES', '/kit  /nickname', '/mute  /hat', '/leaderboard'])
    p.label(14, 14, ['SIDEBAR (ops)', 'gamemode, day,', 'night, rain', 'Open inventory'])
    return p
  })
})();
