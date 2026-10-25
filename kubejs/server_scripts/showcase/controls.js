// priority: 5
// Generic lever -> motor control, persisted with plot ownership across reload/restart.
;(function () {
  ServerEvents.tick(function (event) {
    if (event.server.tickCount % 5 !== 0) return
    var ns = global.evilEyeShowcase, records = ns.records(event.server)
    var BP = Java.loadClass('net.minecraft.core.BlockPos')
    Object.keys(records).forEach(function (key) {
      var r = records[key], level = event.server.getLevel(r.dimension), o = r.origin
      if (!level) return
      r.motors.forEach(function (m) {
        var at = new BP(o.x + m.x, o.y + m.y, o.z + m.z)
        var lever = new BP(o.x + m.lever[0], o.y + m.lever[1], o.z + m.lever[2])
        if (!level.hasChunkAt(at) || !level.hasChunkAt(lever)) return
        if (String(level.getBlockState(at)).indexOf('create:creative_motor') < 0) return
        var motor = level.getBlockEntity(at)
        if (!motor) return
        var state = String(level.getBlockState(lever)), speed = state.indexOf('minecraft:lever') >= 0 && state.indexOf('powered=true') >= 0 ? m.speed : 0
        if (motor.generatedSpeed.getValue() !== speed) motor.generatedSpeed.setValue(speed)
      })
    })
  })
})();
