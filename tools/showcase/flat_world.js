// priority: -7
// FlatWorldFix acceptance, once per boot: the showcase server creates a Superflat world (level-type
// minecraft:flat) with Terralith installed, which without FlatWorldFix replaces the overworld generator.
// Far-apart columns, generated on demand, must all be the default flat layers in the plains biome.
global.evilEyeShowcaseCheck.flatWorld = function (h) {
  var level = h.level, check = h.check
  var BP = Java.loadClass('net.minecraft.core.BlockPos')
  var Heightmap = Java.loadClass('net.minecraft.world.level.levelgen.Heightmap$Types')
  var columns = [[0, 0], [1536, -2048], [-3072, 4096], [6000, 6000]], tops = [], wrong = []
  columns.forEach(function (c) {
    level.getChunk(c[0] >> 4, c[1] >> 4) // generate the column (getHeight alone reads an empty chunk)
    var top = level.getHeight(Heightmap.WORLD_SURFACE, c[0], c[1])
    tops.push(top)
    var layers = [top - 1, top - 2, top - 3, top - 4].map(function (y) { return String(level.getBlockState(new BP(c[0], y, c[1]))) })
    var biome = String(level.getBiome(new BP(c[0], top, c[1])).unwrapKey().get().location())
    var expect = ['grass_block', 'dirt', 'dirt', 'bedrock']
    var ok = expect.every(function (id, i) { return layers[i].indexOf('minecraft:' + id) >= 0 }) && biome === 'minecraft:plains'
    if (!ok) wrong.push(c.join(',') + ' top ' + top + ' ' + layers.map(function (l) { return l.replace(/^Block\{|\}.*$/g, '') }).join('/') + ' ' + biome)
  })
  check(wrong.length === 0, 'Superflat stays flat with Terralith (default layers, plains) at ' + columns.length + ' far columns' + (wrong.length ? ': ' + wrong.join('; ') : ''))
  check(tops.every(function (t) { return t === tops[0] }), 'every Superflat column has the same surface height (' + tops.join(', ') + ')')
}
