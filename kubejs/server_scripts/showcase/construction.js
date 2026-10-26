// priority: 10
// The sole world writer: validate the complete plan before reserving/clearing a plot.
;(function () {
  var ns = global.evilEyeShowcase
  ns.records = function (server) {
    var text = String(server.persistentData.getString('evilEyeShowcasePlots'))
    return text ? JSON.parse(text) : {}
  }
  ns.saveRecords = function (server, records) { server.persistentData.putString('evilEyeShowcasePlots', JSON.stringify(records)) }
  ns.plotKey = function (level, o) { return String(level.dimension) + ':' + o.x + ',' + o.y + ',' + o.z }
  // Create computes contraption collision unions on the common pool. First-use
  // Canary shape classes must resolve on the server thread's mod classloader.
  ns.prepareCollisions = function (level, p, o) {
    var BP = Java.loadClass('net.minecraft.core.BlockPos')
    var Shapes = Java.loadClass('net.minecraft.world.phys.shapes.Shapes')
    var BooleanOp = Java.loadClass('net.minecraft.world.phys.shapes.BooleanOp')
    p.glue.forEach(function (v) {
      var combined = Shapes.empty()
      for (var x = v[0]; x < v[3]; x++) for (var y = v[1]; y < v[4]; y++) for (var z = v[2]; z < v[5]; z++) {
        var at = new BP(o.x + x, o.y + y, o.z + z)
        var shape = level.getBlockState(at).getCollisionShape(level, at).move(x - v[0], y - v[1], z - v[2])
        combined = Shapes.joinUnoptimized(combined, shape, BooleanOp.OR)
      }
    })
  }
  ns.build = function (source, p, o, name, clearOnly) {
    ns.validate(p)
    var BP = Java.loadClass('net.minecraft.core.BlockPos'), AABB = Java.loadClass('net.minecraft.world.phys.AABB')
    var Glue = Java.loadClass('com.simibubi.create.content.contraptions.glue.SuperGlueEntity')
    var Caps = Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities')
    var Parser = Java.loadClass('net.minecraft.commands.arguments.blocks.BlockStateParser')
    var Registries = Java.loadClass('net.minecraft.core.registries.Registries')
    var level = source.getLevel(), server = source.getServer()
    var records = ns.records(server), key = ns.plotKey(level, o), owned = records[key]
    function pos(x, y, z) { return new BP(o.x + x, o.y + y, o.z + z) }
    function xyz(x, y, z) { return (o.x + x) + ' ' + (o.y + y) + ' ' + (o.z + z) }
    function command(s) { return server.getCommands().performPrefixedCommand(source.withSuppressedOutput(), s) }
    function refuse(s) { throw new Error(s + ' No blocks changed.') }
    // Only real impossibilities refuse: the plot is made where the player stands, never found.
    if (clearOnly && !owned) refuse('No showcase at this origin.')
    if (o.y - 1 < level.getMinBuildHeight() || o.y + p.height > level.getMaxBuildHeight()) refuse('Outside build height: this needs y ' + (o.y - 1) + ' to ' + (o.y + p.height - 1) + '. Stand where there is room above and below you.')
    var border = level.getWorldBorder()
    // isWithinBounds(BlockPos) is ambiguous against other overloads in this Rhino build.
    if (o.x < border.getMinX() || o.x + p.width > border.getMaxX() || o.z < border.getMinZ() || o.z + p.depth > border.getMaxZ()) refuse('The plot ahead of you would cross the world border. Face away from the border or move inward.')
    for (var b = 0; b < p.blocks.length; b++) Parser.parseForBlock(level.holderLookup(Registries.BLOCK), p.blocks[b].state + p.blocks[b].nbt, true)
    p.fills.forEach(function (f) { f.items.forEach(function (item) { if (Item.of(item[0], 1).isEmpty()) refuse('Unknown prefill item ' + item[0] + '.') }) })
    for (var lx = 0; lx < p.width; lx += 8) for (var lz = 0; lz < p.depth; lz += 8) {
      if (!level.hasChunkAt(pos(lx, -1, lz)) || !level.hasChunkAt(pos(Math.min(lx + 7, p.width - 1), -1, Math.min(lz + 7, p.depth - 1)))) refuse('Part of the plot ahead of you is not loaded yet. Wait a moment, or walk toward it, then run the command again.')
    }
    var box = new AABB(o.x, o.y - 1, o.z, o.x + p.width, o.y + p.height, o.z + p.depth)
    var sweep = ns.sweepEntities(level, box)
    if (sweep.blocking.length) refuse('Cannot clear the plot ahead of you: ' + sweep.blocking.join('; ') + '. Move it out (or walk somewhere else) and run the command again.')
    sweep.removable.forEach(function (entity) {
      if (String(entity.getType()) !== 'create:super_glue') return
      var eb = entity.getBoundingBox()
      if (eb.minX < box.minX || eb.minY < box.minY || eb.minZ < box.minZ || eb.maxX > box.maxX || eb.maxY > box.maxY || eb.maxZ > box.maxZ) refuse('Glue from something else crosses the plot boundary; walk somewhere else.')
    })
    // A different showcase overlapping this plot is simply replaced; its record is dropped.
    Object.keys(records).forEach(function (k) {
      var r = records[k]
      if (k !== key && r.dimension === String(level.dimension) && o.x < r.origin.x + r.width && o.x + p.width > r.origin.x && o.z < r.origin.z + r.depth && o.z + p.depth > r.origin.z && o.y - 1 < r.origin.y + r.height && o.y + p.height > r.origin.y - 1) delete records[k]
    })
    // Retain the reservation on failure so the operator can clear/retry partial construction.
    records[key] = { name: name, dimension: String(level.dimension), origin: o, width: p.width, depth: p.depth, height: p.height, motors: p.motors }
    ns.saveRecords(server, records)
    if (owned) {
      p.motors.forEach(function (m) { var motor = level.getBlockEntity(pos(m.x, m.y, m.z)); if (motor && motor.generatedSpeed) motor.generatedSpeed.setValue(0) })
      p.bearings.forEach(function (v) { var bearing = level.getBlockEntity(pos(v[0], v[1], v[2])); if (bearing && typeof bearing.disassemble === 'function') bearing.disassemble() })
    }
    sweep.removable.forEach(function (entity) { if (entity.isAlive()) entity.discard() })
    if (owned) {
      // Create can restore captured glue during disassembly; remove those new entities too.
      var restored = level.getEntities(null, box)
      for (var r = 0; r < restored.size(); r++) if (String(restored.get(r).getType()).indexOf('super_glue') >= 0) restored.get(r).discard()
    }
    // Mod inventories can spill their contents in onRemove, so detach every block entity first.
    for (var cx = 0; cx < p.width; cx++) for (var cy = -1; cy < p.height; cy++) for (var cz = 0; cz < p.depth; cz++) {
      var clearAt = pos(cx, cy, cz)
      if (level.getBlockEntity(clearAt) !== null) level.removeBlockEntity(clearAt)
    }
    // UPDATE_CLIENTS | UPDATE_KNOWN_SHAPE | UPDATE_SUPPRESS_DROPS: no neighbour updates, so
    // nothing outside the box reacts, and a removed support spawns no stray items.
    var Blocks = Java.loadClass('net.minecraft.world.level.block.Blocks')
    var air = Blocks.AIR.defaultBlockState(), floorState = Blocks.STONE_BRICKS.defaultBlockState()
    for (var ax = 0; ax < p.width; ax++) for (var az = 0; az < p.depth; az++) {
      for (var ay = 0; ay < p.height; ay++) {
        var airAt = pos(ax, ay, az)
        if (!level.getBlockState(airAt).isAir()) level.setBlock(airAt, air, 50)
      }
      level.setBlock(pos(ax, -1, az), floorState, 50)
    }
    if (clearOnly) { delete records[key]; ns.saveRecords(server, records); return { origin: o, removed: sweep.report } }
    for (var i = 0; i < p.blocks.length; i++) {
      var block = p.blocks[i]
      if (command('setblock ' + xyz(block.x, block.y, block.z) + ' ' + block.state + block.nbt) !== 1) throw new Error('Could not place ' + block.state)
      if (block.state.indexOf('create:creative_motor') === 0) level.getBlockEntity(pos(block.x, block.y, block.z)).generatedSpeed.setValue(0)
    }
    p.fills.forEach(function (fill) {
      var be = level.getBlockEntity(pos(fill.x, fill.y, fill.z)), handler = be.getCapability(Caps.ITEM_HANDLER).orElse(null)
      if (handler === null) throw new Error('Missing inventory at ' + xyz(fill.x, fill.y, fill.z))
      fill.items.forEach(function (item) {
        var stack = Item.of(item[0], item[1])
        for (var slot = 0; slot < handler.getSlots() && !stack.isEmpty(); slot++) stack = handler.insertItem(slot, stack, false)
        if (!stack.isEmpty()) throw new Error('Prefill rejected at ' + xyz(fill.x, fill.y, fill.z))
      })
      be.setChanged()
    })
    p.glue.forEach(function (v) {
      if (!level.addFreshEntity(new Glue(level, new AABB(o.x + v[0], o.y + v[1], o.z + v[2], o.x + v[3], o.y + v[4], o.z + v[5])))) throw new Error('Glue insertion failed')
    })
    return { origin: o, removed: sweep.report }
  }
})();
