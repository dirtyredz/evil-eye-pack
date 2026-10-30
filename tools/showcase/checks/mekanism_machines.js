// priority: -10
global.evilEyeShowcaseCheck.checks = global.evilEyeShowcaseCheck.checks || {}
global.evilEyeShowcaseCheck.checks.mekanism_machines = function (h) {
  var check = h.check, later = h.later
  // Items of one id in a Mekanism block's own slots (its unsided item handler exposes no slots to automation).
  function amount(x, y, z, id) {
    var slots = h.be(x, y, z).getInventorySlots(null), n = 0
    for (var i = 0; i < slots.size(); i++) { var s = slots.get(i).getStack(); if (String(s.getId()) === id) n += s.getCount() }
    return n
  }
  var before = h.shell()
  var Caps = Java.loadClass('net.neoforged.neoforge.capabilities.Capabilities'), Direction = Java.loadClass('net.minecraft.core.Direction')
  // Energy wiring as NeoForge sees it, for a failure message: what each face offers.
  function wiring() {
    function fe(x, y, z, face) { var c = h.level.getCapability(Caps.EnergyStorage.BLOCK, h.pos(x, y, z), face); return c === null ? 'none' : (c.canExtract() ? 'out' : '') + (c.canReceive() ? 'in' : '') + ':' + c.getEnergyStored() }
    function faces(x, y, z) { return Direction.values().map(function (d) { return String(d).toLowerCase()[0] + '=' + fe(x, y, z, d) }).join(' ') + ' null=' + fe(x, y, z, null) }
    return 'cube[' + faces(1, 0, 5) + '] ' + String(h.level.getBlockState(h.pos(1, 0, 5))) + ' chamber[' + faces(3, 0, 4) + '] ' + String(h.level.getBlockState(h.pos(3, 0, 4))) + ' cable(2)[' + faces(2, 0, 5) + ']'
  }
  // Stored Joules of a Mekanism block entity (its own energy containers, side-independent).
  function joules(x, y, z) {
    var containers = h.be(x, y, z).getEnergyContainers(null), total = 0
    for (var i = 0; i < containers.size(); i++) total += Number(containers.get(i).getEnergy())
    return total
  }
  global.evilEyeShowcaseCheck.terrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(h.shell() === before, 'entire exterior shell unchanged after build')
  check(joules(1, 0, 5) > 1e18, 'creative energy cube is placed full')
  check(amount(3, 0, 4, 'minecraft:iron_ore') === 16 && amount(7, 0, 4, 'minecraft:iron_ingot') === 16 && amount(12, 0, 4, 'minecraft:coal') === 32, 'machine inputs prefilled from the plan')
  var ticks = 0
  function poll() { later(5, function () {
    var enriched = amount(3, 0, 4, 'enderio:powdered_iron'), crushed = amount(7, 0, 4, 'enderio:powdered_iron')
    var generated = joules(12, 0, 4)
    if (enriched >= 4 && crushed >= 2 && generated > 0) {
      // Cable transport is not asserted: on this server Mekanism exposes no sided energy capability for command-
      // placed blocks (even vanilla /setblock), so the cube and cable cannot connect headless (dk-1a3141d6).
      check(enriched >= 4 && amount(3, 0, 4, 'mekanism:dust_iron') === 0, 'enrichment chamber doubles iron ore into the Ender IO dust survivor, never Mekanism dust')
      check(amount(3, 0, 4, 'minecraft:iron_ore') < 16, 'enrichment chamber consumed ore')
      check(crushed >= 2 && amount(7, 0, 4, 'mekanism:dust_iron') === 0, 'crusher turns ingots into the Ender IO dust survivor')
      check(generated > 0 && amount(12, 0, 4, 'minecraft:coal') < 32, 'heat generator burns coal into stored energy')
      check(joules(1, 0, 5) > 1e18, 'creative cube stays full while supplying')
      check(h.shell() === before, 'entire exterior shell unchanged while machines run')
      check(h.invoke() === 1, 'running section rebuild succeeds')
      h.verifyPlan()
      check(amount(3, 0, 4, 'enderio:powdered_iron') === 0, 'rebuild resets machine contents to the plan')
      check(h.invoke(null, true) === 1, 'clear command succeeds')
      h.verifyVolume(true)
      check(h.shell() === before, 'entire exterior shell unchanged after teardown')
      h.done()
    } else if ((ticks += 5) >= 1200) throw new Error('Mekanism processing timeout: enriched=' + enriched + ' crushed=' + crushed + ' generated=' + generated + ' chamber J=' + joules(3, 0, 4) + '; ' + wiring())
    else poll()
  }) }
  poll()
}
