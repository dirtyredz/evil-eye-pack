// priority: -10
global.evilEyeShowcaseCheck.checks = global.evilEyeShowcaseCheck.checks || {}
global.evilEyeShowcaseCheck.checks.interstellaris_space = function (h) {
  var check = h.check, later = h.later, o = h.origin, server = h.server, level = h.level
  var Heightmap = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
  var before = h.shell()
  // getLevel(ResourceKey) and getLevel(ResourceLocation) are ambiguous to Rhino; find the level by its key instead.
  function dimension(name) {
    var it = server.getAllLevels().iterator()
    while (it.hasNext()) { var l = it.next(); var key = String(typeof l.dimension === 'function' ? l.dimension() : l.dimension); if (key.indexOf('interstellaris:' + name + ']') >= 0 || key === 'interstellaris:' + name) return l }
    return null
  }
  // Force-load the arrival chunks now: tickets take effect on a later tick (see GOTCHAS).
  ;['moon', 'mars'].forEach(function (name) { h.cmd('execute in interstellaris:' + name + ' run forceload add 0 0') })
  global.evilEyeShowcaseCheck.terrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(h.shell() === before, 'entire exterior shell unchanged after build')
  later(20, function () {
  // Movement between bodies: the planet dimensions exist, generate terrain, and accept a traveller.
  ;['moon', 'mars', 'venus', 'enceladus', 'io'].forEach(function (name) { check(dimension(name) !== null, 'Interstellaris dimension loaded: ' + name) })
  function travel(index) {
    if (index === 2) { physics(); return }
    var name = ['moon', 'mars'][index]
    var target = dimension(name)
    var top = target.getHeight(Heightmap.WORLD_SURFACE, 8, 8)
    var ground = String(target.getBlockState(new h.BP(8, top - 1, 8)))
    check(top > target.getMinBuildHeight() && ground.indexOf('air') < 0, name + ' generates solid ground (top ' + top + ': ' + ground + ')')
    h.cmd('summon minecraft:armor_stand ' + (o.x + 2) + ' ' + (o.y + 1) + ' ' + (o.z + 2) + ' {NoGravity:1b,Tags:["evileye_traveller"]}')
    check(h.run('execute in interstellaris:' + name + ' run tp @e[type=minecraft:armor_stand,tag=evileye_traveller] 8 ' + (top + 2) + ' 8') === 1, 'traveller teleported to ' + name)
    // Dimension transfer can return success before the destination entity tracker exposes the
    // traveller, especially when this section follows the longer storage run in --all.
    var attempts = 0
    later(1, function arrival() {
      var there = target.getEntities(null, new (Java.loadClass('net.minecraft.world.phys.AABB'))(0, top - 4, 0, 16, top + 8, 16))
      var found = 0
      for (var i = 0; i < there.size(); i++) if (there.get(i).getTags().contains('evileye_traveller')) found++
      if (found === 0 && ++attempts < 20) { later(1, arrival); return }
      check(found === 1, 'traveller arrived in the ' + name + ' dimension')
      h.cmd('kill @e[type=minecraft:armor_stand,tag=evileye_traveller]')
      h.cmd('execute in interstellaris:' + name + ' run forceload remove 0 0')
      travel(index + 1)
    })
  }
  travel(0)
  function physics() {
  // Sable assembly and physics: the floating pad becomes a sub-level.
  var px = o.x + 11, py = o.y + 4, pz = o.z + 10
  check(h.run('sable assemble area ' + px + ' ' + py + ' ' + pz + ' ' + (px + 2) + ' ' + py + ' ' + (pz + 2)) >= 1, 'sable assemble area captures the pad')
  check(String(level.getBlockState(h.pos(12, 4, 11))).indexOf('air') >= 0, 'assembled blocks left the static world')
  // Sable's position selectors (x/y/z/distance) matched nothing for the new body in live runs, so the fall itself is
  // an owner check; headless proves assembly and a live physics body for 100 ticks (Rapier natives on the server).
  check(h.run('sable info @e') === 1, 'exactly one Sable sub-level exists after assembly')
  later(100, function () {
    check(h.run('sable info @e') === 1, 'the sub-level survives 100 server ticks of physics')
    check(String(level.getBlockState(h.pos(12, 4, 11))).indexOf('air') >= 0, 'the pad has not been written back to the static world')
    // The fallen body is left in the disposable world: removal syntax is not settled (sub_level remove gave 0).
    later(5, function () {
      check(h.invoke() === 1, 'rebuild restores the floating pad')
      h.verifyPlan()
      check(h.invoke(null, true) === 1, 'clear command succeeds')
      h.verifyVolume(true)
      check(h.shell() === before, 'entire exterior shell unchanged after teardown')
      h.done()
    })
  })
  }
  })
}
