// priority: -5
// Fixture access and assertions shared by section and command-form checks.
// A command's integer result. Forge 1.20's performPrefixedCommand returns it; Minecraft 1.21's returns
// nothing, so the result arrives through the source's CommandResultCallback (onResult(success, value)).
global.evilEyeShowcaseCheck.runCommand = function (server, source, text) {
  var out = { value: null }
  var withResult = source
  try {
    withResult = source.withCallback(function () {
      var a = arguments
      out.value = a.length === 2 ? (a[0] ? a[1] : 0) : (a[1] ? a[2] : 0)
    })
  } catch (e) { withResult = source }
  var returned = server.getCommands().performPrefixedCommand(withResult, text)
  if (typeof returned === 'number') return returned
  return out.value === null ? 0 : out.value
}
global.evilEyeShowcaseCheck.makeHelpers = function makeHelpers(h) {
  var server = h.server, level = h.level, plan = h.plan, o = h.origin, source = h.source, name = h.name
  var BP = Java.loadClass('net.minecraft.core.BlockPos')
  // NeoForge 1.21 block capabilities are looked up on the level; Forge 1.20 asks the block entity.
  var NeoCaps = null, Caps = null
  try { NeoCaps = Java.loadClass('net.neoforged.neoforge.capabilities.Capabilities') } catch (e) { Caps = Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities') }
  h.BP = BP
  // Full block-entity NBT: 1.21 needs the registry provider; Forge 1.20 takes no argument.
  h.nbt = function (be) { try { return be.saveWithFullMetadata(level.registryAccess()) } catch (e) { return be.saveWithFullMetadata() } }
  h.pos = function (x, y, z) { return new BP(o.x + x, o.y + y, o.z + z) }
  h.be = function (x, y, z) { return level.getBlockEntity(h.pos(x, y, z)) }
  // The item handler at a plot position (optionally for one face), or null.
  h.itemHandler = function (x, y, z, face) {
    if (NeoCaps) return level.getCapability(NeoCaps.ItemHandler.BLOCK, h.pos(x, y, z), face || null) || null
    var be = h.be(x, y, z)
    return be ? be.getCapability(Caps.ITEM_HANDLER, face || null).orElse(null) : null
  }
  h.handler = function (x, y, z) { return h.itemHandler(x, y, z) }
  h.amount = function (handler, id) { var n = 0; for (var i = 0; i < handler.getSlots(); i++) { var s = handler.getStackInSlot(i); if (String(s.getId()) === id) n += s.getCount() } return n }
  h.cmd = function (s) { return server.runCommandSilent(s) }
  h.set = function (x, y, z, state) { return h.cmd('setblock ' + (o.x + x) + ' ' + (o.y + y) + ' ' + (o.z + z) + ' ' + state) }
  h.invoke = function (who, clear) { return global.evilEyeShowcaseCheck.runCommand(server, who || source, 'evileye showcase ' + (clear ? 'clear ' : '') + name) }
  // An operator command's result (permission 4, output suppressed), e.g. a count returned by /sable info.
  h.run = function (text) { return global.evilEyeShowcaseCheck.runCommand(server, server.createCommandSourceStack().withSuppressedOutput().withPermission(4), text) }
  h.shell = function () {
    var snapshot = []
    for (var x = -1; x <= plan.width; x++) for (var y = -2; y <= plan.height; y++) for (var z = -1; z <= plan.depth; z++) {
      if (x !== -1 && x !== plan.width && y !== -2 && y !== plan.height && z !== -1 && z !== plan.depth) continue
      var at = h.pos(x, y, z), be = level.getBlockEntity(at)
      snapshot.push(String(level.getBlockState(at)) + (be ? String(h.nbt(be)) : ''))
    }
    return JSON.stringify(snapshot)
  }
  h.verifyPlan = function () {
    plan.blocks.forEach(function (b) {
      var state = String(level.getBlockState(h.pos(b.x, b.y, b.z)))
      var parts = b.state.split('['), properties = parts[1] ? parts[1].replace(']', '').split(',') : []
      h.check(state.indexOf(parts[0]) >= 0 && properties.every(function (p) { return state.indexOf(p) >= 0 }), 'block/state ' + [b.x, b.y, b.z] + ' ' + b.state)
      if (b.state.indexOf('oak_sign') >= 0) {
        var actual = h.nbt(h.be(b.x, b.y, b.z))
        var expected = Java.loadClass('net.minecraft.nbt.TagParser').parseTag(b.nbt)
        var a = actual.getCompound('front_text').getList('messages', 8), e = expected.getCompound('front_text').getList('messages', 8)
        var match = a.size() === 4 && actual.getBoolean('is_waxed')
        // 1.21 saves a plain line as a JSON string ("\"text\""), 1.20 as {"text": ...}; compare the text either way.
        var line = function (list, i) { var v = JSON.parse(String(list.getString(i))); return typeof v === 'string' ? v : (v.text || '') }, got = []
        for (var n = 0; n < 4; n++) { got.push(line(a, n)); if (got[n] !== line(e, n)) match = false }
        h.check(match, 'exact waxed sign text ' + [b.x, b.y, b.z] + (match ? '' : ': ' + JSON.stringify(got) + ' waxed=' + actual.getBoolean('is_waxed')))
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
  // Force-load the plot and a 16-block margin. Takes effect on a later tick: entities summoned into a chunk
  // that is not yet entity-loaded on 1.21 are stored but invisible to getEntities (first NeoForge run).
  h.loadArea = function () { h.cmd('forceload add ' + (o.x - 16) + ' ' + (o.z - 16) + ' ' + (o.x + plan.width + 16) + ' ' + (o.z + plan.depth + 16)) }
  h.prepareTerrain = function () {
    h.loadArea()
    h.cmd('fill ' + (o.x - 1) + ' ' + (o.y - 1) + ' ' + (o.z - 1) + ' ' + (o.x + plan.width) + ' ' + (o.y - 1) + ' ' + (o.z + plan.depth) + ' minecraft:dirt')
    h.cmd('fill ' + (o.x - 1) + ' ' + o.y + ' ' + (o.z - 1) + ' ' + (o.x + plan.width) + ' ' + (o.y + plan.height) + ' ' + (o.z + plan.depth) + ' minecraft:air')
  }
  return h
}
