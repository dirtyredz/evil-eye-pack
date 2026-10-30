// priority: -10
// Pack-test probe (injected into the throwaway test server only; never shipped).
// Live registry and tag snapshots: items, blocks, fluids, entity types, recipe types, loaded mods,
// loaded loot tables, mod registries whose ids recipes output (Mekanism chemicals), and every
// item/block/fluid tag's final members.
// Rhino rules: Java collections are read through toArray() or size()/get(i), never for...of.
;(function () {
  // global.packTest is created by startup_globals.js (KubeJS 2101 only lets startup scripts set globals).
  var ns = global.packTest || (global.packTest = {})
  var BR = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')

  function keys(registry) {
    var a = registry.keySet().toArray()
    var out = []
    for (var i = 0; i < a.length; i++) out.push(String(a[i]))
    out.sort()
    return out
  }

  // Final tag members, read through Registry.getTag(TagKey) -> HolderSet size()/get(i) (see docs/GOTCHAS.md).
  function tags(registry) {
    var names = registry.getTagNames().toArray()
    var out = {}
    for (var i = 0; i < names.length; i++) {
      var key = names[i]
      var opt = registry.getTag(key)
      var ids = []
      if (opt.isPresent()) {
        var set = opt.get()
        // Holder keys, not values: wrapping a mod's Item/Block object makes Rhino reflect its class, which
        // loads client-only classes named in its method signatures (RuntimeDistCleaner errors in the log).
        for (var j = 0; j < set.size(); j++) ids.push(String(set.get(j).unwrapKey().get().location()))
      }
      out[String(key.location())] = ids
    }
    return out
  }

  // Non-item recipe outputs that live in a mod registry: Mekanism's chemicals (gases, slurries, pigments).
  // Absent registries give [] (the id is looked up on the root registry, never iterated).
  var OUTPUT_REGISTRIES = { chemicals: 'mekanism:chemical' }
  function modRegistry(id) {
    var RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
    var registry = BR.REGISTRY.get(RL.parse(id))
    return registry ? keys(registry) : []
  }

  function mods() {
    var list = Platform.getList().toArray()
    var out = {}
    for (var i = 0; i < list.length; i++) {
      var id = String(list[i])
      var info = Platform.getInfo(id)
      out[id] = info ? String(info.getVersion()) : '?'
    }
    return out
  }

  // 1.21: loot tables are a reloadable registry; 1.20: the LootDataManager's TABLE keys.
  function lootTables(server) {
    var a
    if (typeof server.reloadableRegistries === 'function') {
      var Registries = Java.loadClass('net.minecraft.core.registries.Registries')
      a = server.reloadableRegistries().getKeys(Registries.LOOT_TABLE).toArray()
    } else {
      var LDT = Java.loadClass('net.minecraft.world.level.storage.loot.LootDataType')
      a = server.getLootData().getKeys(LDT.TABLE).toArray()
    }
    var out = []
    for (var i = 0; i < a.length; i++) out.push(String(a[i]))
    out.sort()
    return out
  }

  ns.registries = {
    collect: function (server) {
      var data = {
        items: keys(BR.ITEM), blocks: keys(BR.BLOCK), fluids: keys(BR.FLUID), entities: keys(BR.ENTITY_TYPE),
        recipeTypes: keys(BR.RECIPE_TYPE), recipeSerializers: keys(BR.RECIPE_SERIALIZER), mods: mods(), lootTables: lootTables(server)
      }
      for (var name in OUTPUT_REGISTRIES) data[name] = modRegistry(OUTPUT_REGISTRIES[name])
      return { data: data, count: data.items.length }
    },
    collectTags: function () {
      var data = { items: tags(BR.ITEM), blocks: tags(BR.BLOCK), fluids: tags(BR.FLUID) }
      return { data: data, count: Object.keys(data.items).length }
    }
  }
})()
