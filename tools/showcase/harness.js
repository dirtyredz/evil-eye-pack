// priority: -20
// Disposable-server sequencing, lifecycle and one completion marker.
ServerEvents.loaded(function (event) {
  var server = event.server, level = server.overworld(), results = [], finished = false
  var Vec3 = Java.loadClass('net.minecraft.world.phys.Vec3'), Vec2 = Java.loadClass('net.minecraft.world.phys.Vec2')
  function finish(error) {
    if (finished) return
    finished = true
    console.info('SHOWCASE_CHECK COMPLETE ' + JSON.stringify({ ok: !error, error: error ? String(error) : '', assertions: results }))
  }
  function lifecycle(name) {
    return {
      server: server, level: level,
      check: function (ok, message) {
        results.push({ section: name, assertion: message, status: ok ? 'PASS' : 'FAIL' })
        console.info('SHOWCASE_CHECK ' + (ok ? 'PASS ' : 'FAIL ') + name + ': ' + message)
        if (!ok) throw new Error(message)
      },
      later: function (ticks, fn) { server.scheduleInTicks(ticks, function () { if (finished) return; try { fn() } catch (e) { finish(e) } }) }
    }
  }
  function next(index) {
    if (index === global.evilEyeShowcaseCheckSelection.length) {
      var shared = lifecycle('command_forms'); shared.done = function () { finish() }
      global.evilEyeShowcaseCommandForms(shared)
      return
    }
    var name = global.evilEyeShowcaseCheckSelection[index], plan = global.evilEyeShowcase.sections[name]()
    var o = { x: 160 + index * 128, y: 240, z: 0 }, h = lifecycle(name)
    h.name = name; h.plan = plan; h.origin = o
    h.source = server.createCommandSourceStack().withPosition(new Vec3(o.x + Math.floor(plan.width / 2), o.y, o.z - 4)).withRotation(new Vec2(0, 0)).withPermission(2)
    global.evilEyeShowcaseMakeHelpers(h)
    h.done = function () { next(index + 1) }
    h.later(20, function () {
      h.cmd('gamerule doMobSpawning false'); h.cmd('gamerule doDaylightCycle false'); h.cmd('weather clear')
      h.prepareTerrain()
      global.evilEyeShowcaseChecks[name](h)
    })
  }
  try { next(0) } catch (e) { finish(e) }
})
