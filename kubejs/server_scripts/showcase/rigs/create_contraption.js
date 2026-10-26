// priority: 25
// Create-specific plan validation, entity policy, lifecycle and lever control.
;(function () {
  var ns = global.evilEyeShowcase
  ns.createContraption = function () { return { type: 'create_contraption', glue: [], motors: [], bearings: [] } }
  // Create computes contraption collision unions on the common pool. First-use
  // Canary shape classes must resolve on the server thread's mod classloader.
  function prepareCollisions(level, p, o) {
    var BP = Java.loadClass('net.minecraft.core.BlockPos')
    var Shapes = Java.loadClass('net.minecraft.world.phys.shapes.Shapes')
    var BooleanOp = Java.loadClass('net.minecraft.world.phys.shapes.BooleanOp')
    var glue = p.glue
    // Pre-descriptor saves only recorded motors. Read existing glue, never a section factory.
    if (p.legacyBounds) {
      var AABB = Java.loadClass('net.minecraft.world.phys.AABB'), b = p.legacyBounds
      var entities = level.getEntities(null, new AABB(o.x, o.y - 1, o.z, o.x + b[0], o.y + b[1], o.z + b[2]))
      glue = []
      for (var i = 0; i < entities.size(); i++) if (String(entities.get(i).getType()) === 'create:super_glue') {
        var box = entities.get(i).getBoundingBox()
        glue.push([box.minX - o.x, box.minY - o.y, box.minZ - o.z, box.maxX - o.x, box.maxY - o.y, box.maxZ - o.z])
      }
    }
    glue.forEach(function (v) {
      var combined = Shapes.empty()
      for (var x = v[0]; x < v[3]; x++) for (var y = v[1]; y < v[4]; y++) for (var z = v[2]; z < v[5]; z++) {
        var at = new BP(o.x + x, o.y + y, o.z + z)
        var shape = level.getBlockState(at).getCollisionShape(level, at).move(x - v[0], y - v[1], z - v[2])
        combined = Shapes.joinUnoptimized(combined, shape, BooleanOp.OR)
      }
    })
  }
  ns.rigs.create_contraption = {
    legacyRecord: function (r) {
      if (!r.motors) return null
      return { type: 'create_contraption', motors: r.motors, glue: [], bearings: [], legacyBounds: [r.width, r.height, r.depth] }
    },
    validate: function (p, point, seen, integer) {
      if (p.glue.length > 32) throw new Error('Too many glue entities')
      p.glue.forEach(function (g) { point(g[0], g[1], g[2]); point(g[3] - 1, g[4] - 1, g[5] - 1); if (g[3] <= g[0] || g[4] <= g[1] || g[5] <= g[2]) throw new Error('Invalid glue box') })
      p.motors.forEach(function (m) { point(m.x, m.y, m.z); point(m.lever[0], m.lever[1], m.lever[2]); if (!seen[[m.x, m.y, m.z].join(',')] || !seen[m.lever.join(',')] || !integer(m.speed) || Math.abs(m.speed) > 16) throw new Error('Invalid motor control') })
      p.bearings.forEach(function (b) { point(b[0], b[1], b[2]) })
    },
    ownEntity: function (type) { return type === 'create:super_glue' || type.indexOf('contraption') >= 0 },
    preflight: function (sweep, box, refuse) {
      sweep.removable.forEach(function (entity) {
        if (String(entity.getType()) !== 'create:super_glue') return
        var eb = entity.getBoundingBox()
        if (eb.minX < box.minX || eb.minY < box.minY || eb.minZ < box.minZ || eb.maxX > box.maxX || eb.maxY > box.maxY || eb.maxZ > box.maxZ) refuse('Glue from something else crosses the plot boundary; walk somewhere else.')
      })
    },
    teardown: function (d, level, pos) {
      d.motors.forEach(function (m) { var motor = level.getBlockEntity(pos(m.x, m.y, m.z)); if (motor && motor.generatedSpeed) motor.generatedSpeed.setValue(0) })
      d.bearings.forEach(function (v) { var bearing = level.getBlockEntity(pos(v[0], v[1], v[2])); if (bearing && typeof bearing.disassemble === 'function') bearing.disassemble() })
    },
    afterTeardown: function (d, level, box) {
      // Disassembly can restore captured glue after the original entity sweep.
      var restored = level.getEntities(null, box)
      for (var r = 0; r < restored.size(); r++) if (String(restored.get(r).getType()).indexOf('super_glue') >= 0) restored.get(r).discard()
    },
    placed: function (d, level, pos, block) {
      if (block.state.indexOf('create:creative_motor') === 0) level.getBlockEntity(pos(block.x, block.y, block.z)).generatedSpeed.setValue(0)
    },
    finish: function (d, level, o) {
      var Glue = Java.loadClass('com.simibubi.create.content.contraptions.glue.SuperGlueEntity'), AABB = Java.loadClass('net.minecraft.world.phys.AABB')
      d.glue.forEach(function (v) {
        if (!level.addFreshEntity(new Glue(level, new AABB(o.x + v[0], o.y + v[1], o.z + v[2], o.x + v[3], o.y + v[4], o.z + v[5])))) throw new Error('Glue insertion failed')
      })
    },
    tick: function (d, level, o) {
      var BP = Java.loadClass('net.minecraft.core.BlockPos')
      d.motors.forEach(function (m) {
        var at = new BP(o.x + m.x, o.y + m.y, o.z + m.z)
        var lever = new BP(o.x + m.lever[0], o.y + m.lever[1], o.z + m.lever[2])
        if (!level.hasChunkAt(at) || !level.hasChunkAt(lever)) return
        if (String(level.getBlockState(at)).indexOf('create:creative_motor') < 0) return
        var motor = level.getBlockEntity(at)
        if (!motor) return
        var state = String(level.getBlockState(lever)), speed = state.indexOf('minecraft:lever') >= 0 && state.indexOf('powered=true') >= 0 ? m.speed : 0
        if (motor.generatedSpeed.getValue() !== speed) {
          if (speed !== 0) prepareCollisions(level, d, o)
          motor.generatedSpeed.setValue(speed)
        }
      })
    }
  }
})();
