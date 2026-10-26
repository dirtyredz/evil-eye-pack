// priority: -10
global.evilEyeShowcaseChecks = global.evilEyeShowcaseChecks || {}
global.evilEyeShowcaseChecks.contraption_storage = function (h) {
  var check = h.check, later = h.later, amount = h.amount, level = h.level
  var Direction = Java.loadClass('net.minecraft.core.Direction'), AABB = Java.loadClass('net.minecraft.world.phys.AABB')
  var before = h.shell(), plan = h.plan
  function plotEntities() {
    var o = h.origin
    return level.getEntities(null, new AABB(o.x, o.y - 1, o.z, o.x + plan.width, o.y + plan.height, o.z + plan.depth))
  }
  function glueCount() {
    var entities = plotEntities(), count = 0
    for (var i = 0; i < entities.size(); i++) if (String(entities.get(i).getType()).indexOf('super_glue') >= 0) count++
    return count
  }
  // First-time build on hostile terrain (hill, tree, water, hole, mobs); leaves a cleared plot.
  global.evilEyeShowcaseTerrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(glueCount() === 1, 'exactly one glue entity')
  check(h.shell() === before, 'entire exterior shell unchanged after build')
  var faces = [Direction.DOWN, Direction.UP, Direction.NORTH, Direction.SOUTH, Direction.WEST, Direction.EAST]
  plan.fills.forEach(function (f) {
    if (String(level.getBlockState(h.pos(f.x, f.y, f.z))).indexOf('storagedrawers:') < 0) return
    check(h.handler(f.x, f.y, f.z) !== null, 'unsided drawer handler ' + [f.x, f.y, f.z])
    check(h.be(f.x, f.y, f.z).getDrawerAttributes().isShowingQuantity(), 'drawer quantity display enabled ' + [f.x, f.y, f.z])
    faces.forEach(function (face) { check(h.be(f.x, f.y, f.z).getCapability(h.caps.ITEM_HANDLER, face).isPresent(), 'sided drawer handler ' + [f.x, f.y, f.z] + ' ' + face) })
  })
  check(amount(h.handler(17, 0, 8), 'minecraft:iron_nugget') === 162, 'placed compacting conversion: 18 ingots = 162 nuggets')
  check(h.invoke() === 1, 'second invocation succeeds at same origin')
  h.verifyPlan(); check(glueCount() === 1, 'idempotent rebuild replaces glue instead of duplicating')
  check(plotEntities().size() === 1, 'rebuild produces no dropped item entities')
  // Pause hoppers for exact per-inventory PSI accounting; the real automatic circuit runs next.
  h.set(14, 4, 16, 'minecraft:hopper[facing=down,enabled=false]')
  h.set(14, 2, 16, 'minecraft:hopper[facing=down,enabled=false]')
  later(80, function () {
    var bearing = h.be(8, 2, 16), motor = h.be(8, 0, 16)
    check(motor.generatedSpeed.getValue() === 0 && bearing.getMovedContraption() === null, 'motor OFF and unassembled for 80 ticks')
    h.set(7, 1, 16, 'minecraft:lever[face=floor,facing=north,powered=true]')
    var ticks = 0
    function dock() { later(1, function () {
      var entity = bearing.getMovedContraption()
      if (!entity || !h.be(14, 3, 16).canTransfer()) { if (++ticks >= 200) throw new Error('Lever assembly / automatic docking timeout'); dock(); return }
      check(motor.generatedSpeed.getValue() === 2, 'lever ON starts motor at 2 RPM')
      var c = entity.getContraption(), storages = c.getStorage().getAllItemStorages(), all = c.getStorage().getAllItems()
      check(c.getBlocks().size() === 5 && storages.size() === 3, 'bearing assembles five glued blocks and three mounted inventories')
      check(level.getBlockState(h.pos(9, 3, 16)).isAir() && level.getBlockState(h.pos(10, 3, 16)).isAir() && level.getBlockState(h.pos(11, 3, 16)).isAir(), 'all three storage blocks captured from world')
      check(h.be(14, 3, 16).canTransfer(), 'PSI docks automatically')
      var psi = h.handler(14, 3, 16), cases = [['standard drawer', 'minecraft:diamond', 32], ['compacting drawer', 'minecraft:iron_ingot', 18], ['iron chest', 'minecraft:emerald', 32]]
      cases.forEach(function (test) {
        var slot = -1
        for (var i = 0; i < psi.getSlots(); i++) if (String(psi.getStackInSlot(i).getId()) === test[1]) { slot = i; break }
        check(slot >= 0 && amount(all, test[1]) === test[2], test[0] + ' mounted prefill preserved')
        check(psi.insertItem(slot, Item.of(test[1], 11), false).isEmpty() && amount(all, test[1]) === test[2] + 11, test[0] + ' PSI inserts 11 into its occupied slot')
        var extracted = psi.extractItem(slot, 5, false)
        check(String(extracted.getId()) === test[1] && extracted.getCount() === 5 && amount(all, test[1]) === test[2] + 6, test[0] + ' PSI extracts 5 with exact remaining contents')
      })
      check(amount(all, 'minecraft:iron_nugget') === 216 && amount(all, 'minecraft:iron_block') === 2, 'mounted compacting conversion: 24 ingots / 216 nuggets / 2 blocks')
      // Stop at the dock, disassemble, compare each restored inventory, then rebuild for automatic flow.
      h.set(7, 1, 16, 'minecraft:lever[face=floor,facing=north,powered=false]')
      later(10, function () {
        check(motor.generatedSpeed.getValue() === 0 && bearing.getSpeed() === 0, 'lever OFF stops motor and bearing')
        bearing.disassemble()
        later(5, function () {
          check(!entity.isAlive(), 'disassembly removes contraption entity')
          cases.forEach(function (test, i) { check(h.handler(9 + i, 3, 16) !== null && amount(h.handler(9 + i, 3, 16), test[1]) === test[2] + 6, test[0] + ' disassembly preserves exact contents') })
          check(amount(h.handler(10, 3, 16), 'minecraft:iron_nugget') === 216, 'disassembly preserves compacting ratios')
          check(h.invoke() === 1, 'rebuild after disassembly succeeds')
          automatic()
        })
      })
    }) }
    dock()
  })
  function automatic() {
    h.set(7, 1, 16, 'minecraft:lever[face=floor,facing=north,powered=true]')
    var ticks = 0, inserted = false, moved = false
    function poll() { later(1, function () {
      var bearing = h.be(8, 2, 16), entity = bearing.getMovedContraption()
      if (entity) {
        var all = entity.getContraption().getStorage().getAllItems()
        if (amount(all, 'minecraft:diamond') > 32 || amount(all, 'minecraft:iron_ingot') > 18 || amount(all, 'minecraft:emerald') > 32) inserted = true
        if (Math.abs(bearing.getInterpolatedAngle(0)) > 10) moved = true
      }
      var out = h.handler(14, 1, 16), input = h.handler(14, 5, 16)
      var diamond = amount(out, 'minecraft:diamond'), iron = amount(out, 'minecraft:iron_block') * 9 + amount(out, 'minecraft:iron_ingot') + amount(out, 'minecraft:iron_nugget') / 9, emerald = amount(out, 'minecraft:emerald')
      if (inserted && diamond > 0 && iron > 0 && emerald > 0 && moved && amount(input, 'minecraft:diamond') < 16) {
        check(inserted, 'input chest -> hopper -> PSI increases mounted inventory')
        check(diamond > 0, 'standard drawer diamonds reach output chest through PSI/hopper')
        check(iron > 0, 'compacting iron reaches output chest through PSI/hopper')
        check(emerald > 0, 'iron chest emeralds reach output chest through PSI/hopper')
        check(moved, 'bearing rotates beyond ten degrees')
        check(h.shell() === before, 'entire exterior shell unchanged after running contraption')
        check(h.invoke() === 1, 'active contraption rebuild succeeds')
        h.verifyPlan(); check(glueCount() === 1, 'active rebuild leaves exactly one glue')
        check(plotEntities().size() === 1, 'active rebuild produces no dropped item entities')
        check(h.invoke(null, true) === 1, 'clear command succeeds')
        check(glueCount() === 0 && h.be(8, 0, 16) === null, 'clear removes rig and glue')
        h.verifyVolume(true)
        check(h.shell() === before, 'entire exterior shell unchanged after teardown')
        h.done()
      } else if (++ticks >= 2400) throw new Error('Automatic flow timeout: inserted=' + inserted + ' moved=' + moved + ' output=' + [diamond, iron, emerald])
      else poll()
    }) }
    poll()
  }
}
