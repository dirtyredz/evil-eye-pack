// priority: -12
// Shared stress check: a showcase must build first time on hostile ground. Every section's check
// calls global.evilEyeShowcaseTerrain(h) once, then continues from a cleared, flat plot.
global.evilEyeShowcaseTerrain = function (h) {
  var o = h.origin, plan = h.plan, level = h.level, check = h.check
  var AABB = Java.loadClass('net.minecraft.world.phys.AABB')
  var before = h.shell()
  function fill(x1, y1, z1, x2, y2, z2, state) { h.cmd('fill ' + (o.x + x1) + ' ' + (o.y + y1) + ' ' + (o.z + z1) + ' ' + (o.x + x2) + ' ' + (o.y + y2) + ' ' + (o.z + z2) + ' ' + state) }
  function summon(type, x, y, z, nbt) { h.cmd('summon ' + type + ' ' + (o.x + x + 0.5) + ' ' + (o.y + y) + ' ' + (o.z + z + 0.5) + ' ' + nbt) }
  function count(type, x1, z1, x2, z2) {
    var found = level.getEntities(null, new AABB(o.x + x1, o.y - 1, o.z + z1, o.x + x2, o.y + 6, o.z + z2)), n = 0
    for (var i = 0; i < found.size(); i++) if (String(found.get(i).getType()) === type) n++
    return n
  }
  // /kill leaves a dying mob in the world for ~20 ticks; discard synchronously instead.
  function discard(type, x1, z1, x2, z2) {
    var found = level.getEntities(null, new AABB(o.x + x1, o.y - 1, o.z + z1, o.x + x2, o.y + 6, o.z + z2))
    for (var i = 0; i < found.size(); i++) if (String(found.get(i).getType()) === type) found.get(i).discard()
  }
  // Hostile ground: hill, tree, water, a hole through the floor, a chest and a fence in the way.
  fill(2, 0, 2, 8, 4, 8, 'minecraft:stone')
  fill(12, 0, 12, 12, 4, 12, 'minecraft:oak_log'); fill(11, 4, 11, 13, 5, 13, 'minecraft:oak_leaves')
  fill(15, 0, 15, 18, 0, 18, 'minecraft:water'); fill(20, -1, 20, 21, -1, 21, 'minecraft:air')
  h.set(1, 0, 1, 'minecraft:chest'); fill(3, 0, 20, 9, 0, 20, 'minecraft:oak_fence')
  // One mob, one item and one NAMED mob inside; one mob just outside the plot.
  summon('minecraft:slime', 5, 5, 5, '{NoAI:1b,Size:0}')
  summon('minecraft:item', 10, 1, 10, '{Item:{id:"minecraft:dirt",Count:1b}}')
  summon('minecraft:cow', 14, 1, 3, '{NoAI:1b,CustomName:\'{"text":"Bessie"}\'}')
  summon('minecraft:slime', 3, 0, -6, '{NoAI:1b,Size:0}')
  check(count('minecraft:slime', 0, 0, plan.width, plan.depth) === 1 && count('minecraft:item', 0, 0, plan.width, plan.depth) === 1, 'stress setup: mob and item inside the plot')
  check(h.invoke() === 0, 'a named mob inside the plot is refused with a message, not removed')
  check(count('minecraft:slime', 0, 0, plan.width, plan.depth) === 1 && count('minecraft:cow', 0, 0, plan.width, plan.depth) === 1, 'refusal leaves every mob in place')
  check(String(level.getBlockState(h.pos(5, 4, 5))).indexOf('stone') >= 0 && h.be(1, 0, 1) !== null, 'refusal changes no blocks (hill and chest remain)')
  check(['', '{}'].indexOf(String(h.server.persistentData.getString('evilEyeShowcasePlots'))) >= 0, 'refusal reserves nothing')
  discard('minecraft:cow', 0, 0, plan.width, plan.depth)
  check(count('minecraft:cow', 0, 0, plan.width, plan.depth) === 0, 'named mob moved out of the plot')
  check(h.invoke() === 1, 'build succeeds on uneven, wet, tree-covered ground with a hole in the floor')
  check(count('minecraft:slime', 0, 0, plan.width, plan.depth) === 0 && count('minecraft:item', 0, 0, plan.width, plan.depth) === 0, 'unnamed mob and item inside the plot were removed')
  check(count('minecraft:slime', 0, -8, plan.width, -4) === 1, 'a mob outside the plot is untouched')
  h.verifyPlan()
  check(h.shell() === before, 'nothing outside the plot box changed (exterior shell identical)')
  check(h.invoke(null, true) === 1, 'clear after the stress build succeeds')
  h.verifyVolume(true)
  discard('minecraft:slime', 0, -8, plan.width, -4)
}
