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
      if (s && !s.isEmpty()) { out.out = String(s.getId()); out.outCount = s.getCount() } // getId(): no Item object wrapped
    } catch (e) { out.outError = String(e).slice(0, 200) }
    if (eventJson[out.id]) out.json = eventJson[out.id]
    return out
  }

  // Asks RecipeManager for every registered RecipeType's recipes so each recipe keeps its real type.
  // (rm.getRecipes() is not usable: KubeJS resolves it to the type map in one context and to the flat
  // recipe collection in another.) Recipes of an unregistered type cannot exist, so this is complete.
  function collect(server) {
    var rm = server.getRecipeManager()
    var registryAccess = server.registryAccess()
    var list = []
    var types = BR.RECIPE_TYPE.keySet().toArray()
    var total = rm.getRecipeIds().toArray().length
    for (var i = 0; i < types.length; i++) {
      var typeId = String(types[i])
      var recipes = rm.getAllRecipesFor(BR.RECIPE_TYPE.get(types[i])).toArray()
      for (var j = 0; j < recipes.length; j++) list.push(describe(recipes[j], typeId, registryAccess))
    }
    if (list.length !== total) throw new Error('collected ' + list.length + ' recipes by type but the manager holds ' + total)
    return { data: list, count: list.length }
  }

  ns.recipes = { capture: capture, collect: collect }
})()
