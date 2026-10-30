// priority: -13
// Pack-test probe (test server only). Evidence about the script runtime itself, so assumptions the pack's
// scripts rely on are observed in a live server rather than inferred from docs:
//   global: a server script adding a property to a startup-created object
//   nativeEvents: a NativeEvents listener registered with a class-name string (startup_globals.js) fired
//   jsonIo: the shape JsonIO.read returns for a pack config
//   stacks: encoded data components of chosen items' creative-tab stacks (for the EMI curation rules)
;(function () {
  var ns = global.packTest || (global.packTest = {})
  var STACK_IDS = ['enderio:filled_soul_vial', 'enderio:broken_spawner']

  function encode(stack) {
    var Patch = Java.loadClass('net.minecraft.core.component.DataComponentPatch')
    var NbtOps = Java.loadClass('net.minecraft.nbt.NbtOps')
    var r = Patch.CODEC.encodeStart(NbtOps.INSTANCE, stack.getComponentsPatch()).result()
    return r.isPresent() ? String(r.get()) : null
  }

  function stacks(server) {
    var out = {}
    STACK_IDS.forEach(function (id) { out[id] = [] })
    var Tabs = Java.loadClass('net.minecraft.world.item.CreativeModeTabs')
    var BR = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
    Tabs.tryRebuildTabContents(server.getWorldData().enabledFeatures(), true, server.registryAccess())
    var tabs = BR.CREATIVE_MODE_TAB.stream().toList().toArray()
    // Compare against the chosen Item objects with ItemStack.is: calling getItem() on every stack would make
    // Rhino reflect each Item subclass, and client-only method signatures log dist errors (boot 5).
    var RL = Java.loadClass('net.minecraft.resources.ResourceLocation')
    var targets = STACK_IDS.map(function (id) { return { id: id, item: BR.ITEM.get(RL.parse(id)) } })
    for (var t = 0; t < tabs.length; t++) {
      var items = tabs[t].getDisplayItems().toArray()
      for (var i = 0; i < items.length; i++) {
        for (var k = 0; k < targets.length; k++) {
          if (items[i].is(targets[k].item) && out[targets[k].id].length < 8) out[targets[k].id].push(encode(items[i]))
        }
      }
    }
    return out
  }

  function collect(server) {
    var data = { global: {}, nativeEvents: ns.nativeEvents || null, jsonIo: {}, stacks: {} }
    try { ns.nestedProbe = 1; data.global.nestedWrite = ns.nestedProbe === 1 ? 'allowed' : 'ignored' } catch (e) { data.global.nestedWrite = 'refused: ' + e }
    // A top-level write is not attempted: on KubeJS 2101 it aborts the whole ServerEvents.loaded handler
    // ("'global' cannot be assigned to in client or server scripts", pack-test boot 4, 2026-10-29), which
    // try/catch does not stop.
    try {
      var j = JsonIO.read('kubejs/config/dedup.json')
      data.jsonIo = { javaType: String(j && j.getClass ? j.getClass().getName() : typeof j), hiddenOnlyIsArray: Array.isArray(j.hiddenOnly), hiddenOnlyLength: j.hiddenOnly ? j.hiddenOnly.length : null, keys: Object.keys(j).length }
    } catch (e) { data.jsonIo = { error: String(e).slice(0, 300) } }
    try { data.stacks = stacks(server) } catch (e) { data.stacks = { error: String(e).slice(0, 300) } }
    return { data: data, count: Object.keys(data.stacks).length }
  }

  ns.runtime = { collect: collect }
})()
