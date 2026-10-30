// priority: -10
global.evilEyeShowcaseCheck.checks = global.evilEyeShowcaseCheck.checks || {}
global.evilEyeShowcaseCheck.checks.interstellaris_space = function (h) {
  var check = h.check, later = h.later, o = h.origin, server = h.server, level = h.level
  var Registries = Java.loadClass('net.minecraft.core.registries.Registries')
  var ResourceKey = Java.loadClass('net.minecraft.resources.ResourceKey')
  var RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
  var Heightmap = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
  var before = h.shell()
  function dimension(name) { return server.getLevel(ResourceKey.create(Registries.DIMENSION, RL.parse('interstellaris:' + name))) }
  // Sable sub-levels inside an absolute box, counted by /sable info with a volume selector.
  function subLevels(x, y, z, dx, dy, dz) {
    return h.run('sable info @e[x=' + x + ',y=' + y + ',z=' + z + ',dx=' + dx + ',dy=' + dy + ',dz=' + dz + ']')
  }
  global.evilEyeShowcaseCheck.terrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(h.shell() === before, 'entire exterior shell unchanged after build')
  // Movement between bodies: the planet dimensions exist, generate terrain, and accept a traveller.
  ;['moon', 'mars', 'venus', 'enceladus', 'io'].forEach(function (name) { check(dimension(name) !== null, 'Interstellaris dimension loaded: ' + name) })
  ;['moon', 'mars'].forEach(function (name) {
    var target = dimension(name)
    h.cmd('execute in interstellaris:' + name + ' run forceload add 0 0')
    var top = target.getHeight(Heightmap.WORLD_SURFACE, 8, 8)
    var ground = String(target.getBlockState(new h.BP(8, top - 1, 8)))
    check(top > target.getMinBuildHeight() && ground.indexOf('air') < 0, name + ' generates solid ground (top ' + top + ': ' + ground + ')')
    h.cmd('summon minecraft:armor_stand ' + (o.x + 2) + ' ' + (o.y + 1) + ' ' + (o.z + 2) + ' {NoGravity:1b,Tags:["evileye_traveller"]}')
    check(h.run('execute in interstellaris:' + name + ' run tp @e[type=minecraft:armor_stand,tag=evileye_traveller] 8 ' + (top + 2) + ' 8') === 1, 'traveller teleported to ' + name)
    var there = target.getEntities(null, new (Java.loadClass('net.minecraft.world.phys.AABB'))(0, top - 4, 0, 16, top + 8, 16))
    var found = 0
    for (var i = 0; i < there.size(); i++) if (there.get(i).getTags().contains('evileye_traveller')) found++
    check(found === 1, 'traveller arrived in the ' + name + ' dimension')
    h.cmd('kill @e[type=minecraft:armor_stand,tag=evileye_traveller]')
    h.cmd('execute in interstellaris:' + name + ' run forceload remove 0 0')
  })
  // Sable assembly and physics: the floating pad becomes a sub-level and falls onto the floor.
  var px = o.x + 11, py = o.y + 4, pz = o.z + 10
  check(h.run('sable assemble area ' + px + ' ' + py + ' ' + pz + ' ' + (px + 2) + ' ' + py + ' ' + (pz + 2)) >= 1, 'sable assemble area captures the pad')
  check(String(level.getBlockState(h.pos(12, 4, 11))).indexOf('air') >= 0, 'assembled blocks left the static world')
  check(subLevels(px - 1, py - 1, pz - 1, 4, 3, 4) === 1, 'one sub-level at the pad position right after assembly')
  var ticks = 0
  function fall() { later(5, function () {
    var high = subLevels(px - 1, py - 1, pz - 1, 4, 3, 4), low = subLevels(px - 1, o.y - 1, pz - 1, 4, 3, 4)
    if (high === 0 && low === 1) {
      check(true, 'the sub-level fell from the pad height onto the floor (physics ran on the server)')
      check(h.run('sable sub_level remove @e[x=' + (px - 2) + ',y=' + (o.y - 2) + ',z=' + (pz - 2) + ',dx=6,dy=9,dz=6]') >= 1, 'sable removes the fallen sub-level')
      later(5, function () {
        check(subLevels(px - 2, o.y - 2, pz - 2, 6, 9, 6) === 0, 'no sub-level left in the plot')
        check(h.invoke() === 1, 'rebuild restores the floating pad')
        h.verifyPlan()
        check(h.invoke(null, true) === 1, 'clear command succeeds')
        h.verifyVolume(true)
        check(h.shell() === before, 'entire exterior shell unchanged after teardown')
        h.done()
      })
    } else if ((ticks += 5) >= 400) throw new Error('Sable fall timeout: at pad height ' + high + ', on floor ' + low)
    else fall()
  }) }
  fall()
}
