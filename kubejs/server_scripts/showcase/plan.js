// priority: 30
// Pure, bounded plans. Coordinates are east/up/south; labels face the north entrance.
;(function () {
  var ns = global.evilEyeShowcase = { sections: {}, rigs: {}, FLOOR: 'minecraft:stone_bricks' }
  ns.rigHook = function (descriptor, method, args) {
    var rig = descriptor && ns.rigs[descriptor.type]
    if (rig && rig[method]) return rig[method].apply(rig, [descriptor].concat(args || []))
  }
  function integer(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n }
  function inBounds(p, x, y, z) {
    return integer(x) && integer(y) && integer(z) && x >= 0 && x < p.width && y >= -1 && y < p.height && z >= 0 && z < p.depth
  }
  ns.register = function (name, factory) {
    if (!/^[a-z][a-z0-9_]*$/.test(name) || name === 'list' || name === 'clear' || name === 'constructor' || name === '__proto__') throw new Error('Invalid section name: ' + name)
    if (ns.sections[name]) throw new Error('Duplicate section: ' + name)
    if (typeof factory !== 'function') throw new Error('Section factory must be a function')
    ns.sections[name] = factory
  }
  ns.validate = function (p) {
    if (!integer(p.width) || !integer(p.depth) || !integer(p.height) || p.width < 1 || p.depth < 1 || p.height < 1 || p.width * p.depth * (p.height + 1) > 32768) throw new Error('Invalid plot dimensions')
    function point(x, y, z) {
      if (!inBounds(p, x, y, z)) throw new Error('Showcase placement outside bounds')
    }
    var seen = {}
    p.blocks.forEach(function (b) { point(b.x, b.y, b.z); var k = [b.x, b.y, b.z].join(','); if (seen[k]) throw new Error('Duplicate placement ' + k); seen[k] = true })
    p.fills.forEach(function (f) {
      point(f.x, f.y, f.z)
      if (!seen[[f.x, f.y, f.z].join(',')]) throw new Error('Inventory without block')
      f.items.forEach(function (item) { if (!/^[a-z0-9_.-]+:[a-z0-9_/.-]+$/.test(item[0]) || !integer(item[1]) || item[1] < 1 || item[1] > 2147483647) throw new Error('Invalid inventory prefill') })
    })
    if (p.rig && !ns.rigs[p.rig.type]) throw new Error('Unknown rig: ' + p.rig.type)
    ns.rigHook(p.rig, 'validate', [point, seen, integer])
    return p
  }
  ns.plan = function (width, depth, height) {
    var p = { width: width, depth: depth, height: height, blocks: [], fills: [], rig: null }
    p.block = function (x, y, z, state, nbt) {
      if (!inBounds(p, x, y, z)) throw new Error('Showcase placement outside bounds')
      p.blocks.push({ x: x, y: y, z: z, state: state, nbt: nbt || '' })
    }
    p.label = function (x, z, lines) {
      var messages = []
      for (var i = 0; i < 4; i++) messages.push(JSON.stringify(JSON.stringify({ text: lines[i] || '' })))
      p.block(x, 0, z, 'minecraft:oak_sign[rotation=8]', '{is_waxed:1b,front_text:{has_glowing_text:1b,messages:[' + messages.join(',') + ']}}')
    }
    p.sample = function (x, z, state, items, lines) {
      p.block(x, 0, z, state)
      p.fills.push({ x: x, y: 0, z: z, items: items })
      p.label(x + 2, z, lines)
    }
    return p
  }
  ns.layout = function (plans, source) {
    var width = 0, depth = 0, height = 0, gap = 8
    plans.forEach(function (p, i) { width += p.width + (i ? gap : 0); depth = Math.max(depth, p.depth); height = Math.max(height, p.height) })
    var at = source.getPosition()
    // Vec3 field/method collisions require accessors in Rhino.
    var base = ns.origin(at.x(), at.y(), at.z(), source.getRotation().y, { width: width, depth: depth }), x = base.x
    var origins = plans.map(function (p) { var o = { x: x, y: base.y, z: base.z }; x += p.width + gap; return o })
    return { width: width, depth: depth, height: height, origins: origins }
  }
  // Keep world-east labels even when the player approaches from another direction.
  ns.origin = function (x, y, z, yaw, p) {
    var dir = ((Math.floor(yaw / 90 + 0.5) % 4) + 4) % 4
    var ox = Math.floor(x) - Math.floor(p.width / 2), oz = Math.floor(z) - Math.floor(p.depth / 2)
    if (dir === 0) oz = Math.floor(z) + 4
    if (dir === 1) ox = Math.floor(x) - p.width - 3
    if (dir === 2) oz = Math.floor(z) - p.depth - 3
    if (dir === 3) ox = Math.floor(x) + 4
    return { x: ox, y: Math.floor(y), z: oz }
  }
})();
