// priority: -20
// Disposable-server orchestration. Section modules register tests, never independent boot hooks.
ServerEvents.loaded(function (event) {
  var server = event.server, level = server.overworld(), results = [], finished = false
  var BP = Java.loadClass('net.minecraft.core.BlockPos'), Vec3 = Java.loadClass('net.minecraft.world.phys.Vec3')
  var Vec2 = Java.loadClass('net.minecraft.world.phys.Vec2'), Caps = Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities')
  function finish(error) {
    if (finished) return
    finished = true
    console.info('SHOWCASE_CHECK COMPLETE ' + JSON.stringify({ ok: !error, error: error ? String(error) : '', assertions: results }))
  }
  function next(index) {
    if (index === global.evilEyeShowcaseCheckSelection.length) { finish(); return }
    var name = global.evilEyeShowcaseCheckSelection[index], plan = global.evilEyeShowcase.sections[name]()
    var o = { x: 160 + index * 128, y: 240, z: 0 }
    var source = server.createCommandSourceStack().withPosition(new Vec3(o.x + Math.floor(plan.width / 2), o.y, -4)).withRotation(new Vec2(0, 0)).withPermission(2)
    var h = { server: server, level: level, plan: plan, origin: o, source: source, BP: BP, caps: Caps, name: name }
    h.check = function (ok, message) {
      results.push({ section: name, assertion: message, status: ok ? 'PASS' : 'FAIL' })
      console.info('SHOWCASE_CHECK ' + (ok ? 'PASS ' : 'FAIL ') + name + ': ' + message)
      if (!ok) throw new Error(message)
    }
    h.later = function (ticks, fn) { server.scheduleInTicks(ticks, function () { if (finished) return; try { fn() } catch (e) { finish(e) } }) }
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
        var key = [x, y, z].join(','), want = expected[key] || (y === -1 ? 'minecraft:stone_bricks' : 'minecraft:air')
        if (!mismatch && String(level.getBlockState(h.pos(x, y, z))).indexOf(want) < 0) mismatch = key + ' expected ' + want
      }
      h.check(!mismatch, (cleared ? 'cleared' : 'built') + ' complete volume matches plan and floor' + (mismatch ? ': ' + mismatch : ''))
    }
    h.done = function () { next(index + 1) }
    h.later(20, function () {
      h.cmd('gamerule doMobSpawning false'); h.cmd('gamerule doDaylightCycle false'); h.cmd('weather clear')
      h.cmd('forceload add ' + (o.x - 16) + ' -16 ' + (o.x + plan.width + 16) + ' ' + (plan.depth + 16))
      h.cmd('fill ' + (o.x - 1) + ' 239 -1 ' + (o.x + plan.width) + ' 239 ' + plan.depth + ' minecraft:dirt')
      h.cmd('fill ' + (o.x - 1) + ' 240 -1 ' + (o.x + plan.width) + ' ' + (o.y + plan.height) + ' ' + plan.depth + ' minecraft:air')
      global.evilEyeShowcaseChecks[name](h)
    })
  }
  try { next(0) } catch (e) { finish(e) }
})
