// Release 1 only. Delete this script and its manifest when removing the two mods.
// Literal item ingredients preserve the old stack as the input. Almost Unified
// must ignore this recipe namespace in BOTH unification and duplicate removal.
;(function () {
  var migration = JsonIO.read('kubejs/config/ato_retirement.json')
  if (migration == null) throw new Error('[ATO retirement] Missing conversion manifest')
  var conversions = migration.conversions
  var sources = Object.keys(conversions)

  ServerEvents.recipes(function (event) {
    sources.forEach(function (source) {
      var target = conversions[source]
      if (!Item.exists(source) || !Item.exists(target)) {
        throw new Error('[ATO retirement] Unknown item: ' + source + ' -> ' + target)
      }
      event.shapeless(target, [source]).id('kubejs:ato_retirement/' + source.replace(':', '/'))
    })
    console.info('[ATO retirement] Registered ' + sources.length + ' one-to-one conversions')
  })

  ServerEvents.afterRecipes(function (event) {
    var count = event.countRecipes({ id: /^kubejs:ato_retirement\// })
    if (count !== sources.length) {
      throw new Error('[ATO retirement] Expected ' + sources.length + ' loaded conversions, found ' + count)
    }
    console.info('[ATO retirement] Verified ' + count + ' loaded conversion recipes')
  })
})()
