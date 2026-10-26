// priority: 10
// Generic build stages. Preflight finishes before ownership or world mutations.
;(function () {
  var ns = global.evilEyeShowcase
  function preflight(source, p, o, clearOnly) {
    ns.validate(p)
    var BP = Java.loadClass('net.minecraft.core.BlockPos'), AABB = Java.loadClass('net.minecraft.world.phys.AABB')
    var Parser = Java.loadClass('net.minecraft.commands.arguments.blocks.BlockStateParser')
    var Registries = Java.loadClass('net.minecraft.core.registries.Registries')
    var level = source.getLevel(), server = source.getServer()
    var records = ns.records(server), key = ns.plotKey(level, o), owned = records[key], displaced = ns.displacedBy(records, level, p, o)
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
    Object.keys(ns.rigs).forEach(function (key) { var rig = ns.rigs[key]; if (rig.preflight) rig.preflight(sweep, box, refuse) })
    var floorState = Parser.parseForBlock(level.holderLookup(Registries.BLOCK), ns.FLOOR, true).blockState()
    return { p: p, o: o, level: level, server: server, records: records, key: key, owned: owned, displaced: displaced, BP: BP, AABB: AABB, pos: pos, xyz: xyz, command: command, box: box, sweep: sweep, floorState: floorState }
  }
  function teardown(ctx) {
    var p = ctx.p, level = ctx.level, pos = ctx.pos
    // Each displaced plot is dismantled with its own recorded rig at its own origin, never the incoming plan's.
    var olds = ctx.displaced.map(function (r) {
      return { rig: ns.recordRig(r), pos: function (x, y, z) { return new ctx.BP(r.origin.x + x, r.origin.y + y, r.origin.z + z) }, box: new ctx.AABB(r.origin.x, r.origin.y - 1, r.origin.z, r.origin.x + r.width, r.origin.y + r.height, r.origin.z + r.depth) }
    })
    olds.forEach(function (old) { ns.rigHook(old.rig, 'teardown', [level, old.pos]) })
    ctx.sweep.removable.forEach(function (entity) { if (entity.isAlive()) entity.discard() })
    olds.forEach(function (old) { ns.rigHook(old.rig, 'afterTeardown', [level, old.box]) })
    // Mod inventories can spill their contents in onRemove, so detach every block entity first.
    for (var cx = 0; cx < p.width; cx++) for (var cy = -1; cy < p.height; cy++) for (var cz = 0; cz < p.depth; cz++) {
      var clearAt = pos(cx, cy, cz)
      if (level.getBlockEntity(clearAt) !== null) level.removeBlockEntity(clearAt)
    }
    // UPDATE_CLIENTS | UPDATE_KNOWN_SHAPE | UPDATE_SUPPRESS_DROPS: no neighbour updates, so
    // nothing outside the box reacts, and a removed support spawns no stray items.
    var Blocks = Java.loadClass('net.minecraft.world.level.block.Blocks')
    var air = Blocks.AIR.defaultBlockState(), floorState = ctx.floorState
    for (var ax = 0; ax < p.width; ax++) for (var az = 0; az < p.depth; az++) {
      for (var ay = 0; ay < p.height; ay++) {
        var airAt = pos(ax, ay, az)
        if (!level.getBlockState(airAt).isAir()) level.setBlock(airAt, air, 50)
      }
      level.setBlock(pos(ax, -1, az), floorState, 50)
    }
  }
  function place(ctx) {
    var p = ctx.p, level = ctx.level, pos = ctx.pos, xyz = ctx.xyz, command = ctx.command
    for (var i = 0; i < p.blocks.length; i++) {
      var block = p.blocks[i]
      if (command('setblock ' + xyz(block.x, block.y, block.z) + ' ' + block.state + block.nbt) !== 1) throw new Error('Could not place ' + block.state)
      ns.rigHook(p.rig, 'placed', [level, pos, block])
    }
  }
  function finish(ctx) {
    var p = ctx.p, level = ctx.level, pos = ctx.pos, xyz = ctx.xyz
    var Caps = Java.loadClass('net.minecraftforge.common.capabilities.ForgeCapabilities')
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
    ns.rigHook(p.rig, 'finish', [level, ctx.o])
  }
  ns.build = function (source, p, o, name, clearOnly) {
    var ctx = preflight(source, p, o, clearOnly)
    // Old plots are dismantled before any record changes, so a failed teardown stays retryable.
    teardown(ctx)
    // Retain the reservation after a partial placement failure for clear/retry.
    ns.reservePlot(ctx.server, ctx.records, ctx.key, ctx.level, p, o, name)
    if (clearOnly) { delete ctx.records[ctx.key]; ns.saveRecords(ctx.server, ctx.records) }
    else { place(ctx); finish(ctx) }
    return { origin: o, removed: ctx.sweep.report }
  }
})();
