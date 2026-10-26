// priority: -5
// Fixture access and assertions shared by section and command-form checks.
global.evilEyeShowcaseMakeHelpers = function makeHelpers(h) {
  var server = h.server, level = h.level, plan = h.plan, o = h.origin, source = h.source, name = h.name
  var BP = Java.loadClass('net.minecraft.core.BlockPos'), Caps = Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities')
  h.BP = BP; h.caps = Caps
  h.pos = function (x, y, z) { return new BP(o.x + x, o.y + y, o.z + z) }
  h.be = function (x, y, z) { return level.getBlockEntity(h.pos(x, y, z)) }
  h.handler = function (x, y, z) { var be = h.be(x, y, z); return be ? be.getCapability(Caps.ITEM_HANDLER).orElse(null) : null }
  h.amount = function (handler, id) { var n = 0; for (var i = 0; i < handler.getSlots(); i++) { var s = handler.getStackInSlot(i); if (String(s.getId()) === id) n += s.getCount() } return n }
  h.cmd = function (s) { return server.runCommandSilent(s) }
  h.set = function (x, y, z, state) { return h.cmd('setblock ' + (o.x + x) + ' ' + (o.y + y) + ' ' + (o.z + z) + ' ' + state) }
  h.invoke = function (who, clear) { return server.getCommands().performPrefixedCommand(who || source, 'evileye showcase ' + (clear ? 'clear ' : '') + name) }
  h.shell = function () {
    var snapshot = []
    for (var x = -1; x <= plan.width; x++) for (var y = -2; y <= plan.height; y++) for (var z = -1; z <= plan.depth; z++) {
      if (x !== -1 && x !== plan.width && y !== -2 && y !== plan.height && z !== -1 && z !== plan.depth) continue
      var at = h.pos(x, y, z), be = level.getBlockEntity(at)
      snapshot.push(String(level.getBlockState(at)) + (be ? String(be.saveWithFullMetadata()) : ''))
    }
    return JSON.stringify(snapshot)
  }
  h.verifyPlan = function () {
    plan.blocks.forEach(function (b) {
      var state = String(level.getBlockState(h.pos(b.x, b.y, b.z)))
      var parts = b.state.split('['), properties = parts[1] ? parts[1].replace(']', '').split(',') : []
      h.check(state.indexOf(parts[0]) >= 0 && properties.every(function (p) { return state.indexOf(p) >= 0 }), 'block/state ' + [b.x, b.y, b.z] + ' ' + b.state)
      if (b.state.indexOf('oak_sign') >= 0) {
        var actual = h.be(b.x, b.y, b.z).saveWithFullMetadata()
        var expected = Java.loadClass('net.minecraft.nbt.TagParser').parseTag(b.nbt)
        var a = actual.getCompound('front_text').getList('messages', 8), e = expected.getCompound('front_text').getList('messages', 8)
        var match = a.size() === 4 && actual.getBoolean('is_waxed')
        for (var line = 0; line < 4; line++) if (JSON.parse(String(a.getString(line))).text !== JSON.parse(String(e.getString(line))).text) match = false
        h.check(match, 'exact waxed sign text ' + [b.x, b.y, b.z])
      }
    })
    plan.fills.forEach(function (f) { f.items.forEach(function (item) { h.check(h.amount(h.handler(f.x, f.y, f.z), item[0]) === item[1], 'prefill ' + [f.x, f.y, f.z] + ' ' + item[0] + '=' + item[1]) }) })
    h.verifyVolume(false)
  }
  h.verifyVolume = function (cleared) {
    var expected = {}, mismatch = ''
    if (!cleared) plan.blocks.forEach(function (b) { expected[[b.x, b.y, b.z].join(',')] = b.state.split('[')[0] })
    for (var x = 0; x < plan.width; x++) for (var y = -1; y < plan.height; y++) for (var z = 0; z < plan.depth; z++) {
      var key = [x, y, z].join(','), want = expected[key] || (y === -1 ? global.evilEyeShowcase.FLOOR : 'minecraft:air')
      if (!mismatch && String(level.getBlockState(h.pos(x, y, z))).indexOf(want) < 0) mismatch = key + ' expected ' + want
    }
    h.check(!mismatch, (cleared ? 'cleared' : 'built') + ' complete volume matches plan and floor' + (mismatch ? ': ' + mismatch : ''))
  }
  h.prepareTerrain = function () {
    h.cmd('forceload add ' + (o.x - 16) + ' ' + (o.z - 16) + ' ' + (o.x + plan.width + 16) + ' ' + (o.z + plan.depth + 16))
    h.cmd('fill ' + (o.x - 1) + ' ' + (o.y - 1) + ' ' + (o.z - 1) + ' ' + (o.x + plan.width) + ' ' + (o.y - 1) + ' ' + (o.z + plan.depth) + ' minecraft:dirt')
    h.cmd('fill ' + (o.x - 1) + ' ' + o.y + ' ' + (o.z - 1) + ' ' + (o.x + plan.width) + ' ' + (o.y + plan.height) + ' ' + (o.z + plan.depth) + ' minecraft:air')
  }
  return h
}
