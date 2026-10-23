// priority: -11
// Pack-test probe (test server only). Every recipe in the final live RecipeManager, normalized:
// { id, type (RecipeType id), ser (serializer id), special, ings: [{ j, n, empty, barrier }], out, outCount, json? }.
// json is the effective recipe JSON KubeJS saw in its recipe event (after data overrides and removals),
// kept for non-vanilla serializers so nested and probabilistic outputs can be checked offline.
;(function () {
  var ns = (global.packTest = global.packTest || {})
  var BR = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
  var eventJson = {}

  // Called from ServerEvents.recipes (registered by bootstrap.js after every pack script's handler).
  function capture(event) {
    event.forEachRecipe({}, function (r) {
      var ser = String(r.getType())
      if (ser.indexOf('minecraft:') !== 0) eventJson[String(r.getId())] = r.json
    })
  }

  function ingredient(ing) {
    var o = { j: '', n: 0, empty: false, barrier: false }
    try { o.j = String(ing.toJson()) } catch (e) { o.j = '{"type":"<unserializable>"}' }
    try { o.empty = !!ing.isEmpty() } catch (e) { /* custom ingredient without isEmpty */ }
    try {
      var ids = ing.getItemIds()
      o.n = ids.size()
      o.barrier = o.n === 1 && ids.contains('minecraft:barrier')
    } catch (e) { o.n = -1 }
    return o
  }

  function describe(r, typeId, registryAccess) {
    var out = { id: String(r.getId()), type: typeId, ser: String(r.getType()), special: false, ings: [], out: null, outCount: 0 }
    try { out.special = !!r.isSpecial() } catch (e) { /* keep false */ }
    try {
      var ings = r.getIngredients()
      for (var i = 0; i < ings.size(); i++) out.ings.push(ingredient(ings.get(i)))
    } catch (e) { out.ingError = String(e).slice(0, 200) }
    try {
      var s = r.getResultItem(registryAccess)
      if (s && !s.isEmpty()) { out.out = String(BR.ITEM.getKey(s.getItem())); out.outCount = s.getCount() }
    } catch (e) { out.outError = String(e).slice(0, 200) }
    if (eventJson[out.id]) out.json = eventJson[out.id]
    return out
  }

  // Walks RecipeManager's type -> (id -> recipe) map so each recipe keeps its real RecipeType.
  function collect(server) {
    var rm = server.getRecipeManager()
    var registryAccess = server.registryAccess()
    var list = []
    var byType = rm.getRecipes()
    var entries = byType.entrySet().toArray()
    for (var i = 0; i < entries.length; i++) {
      var typeId = String(BR.RECIPE_TYPE.getKey(entries[i].getKey()))
      var recipes = entries[i].getValue().values().toArray()
      for (var j = 0; j < recipes.length; j++) list.push(describe(recipes[j], typeId, registryAccess))
    }
    return { data: list, count: list.length }
  }

  ns.recipes = { capture: capture, collect: collect }
})()
