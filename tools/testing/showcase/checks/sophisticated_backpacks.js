// priority: -10
// Sophisticated Backpacks on the live pack server: the build, Core and the Create addon loaded, the Curios
// "back" slot present, every backpack tier accepted by that slot's item tag, and the basic recipe present.
// Screens, the worn model and the mounted backpack on a contraption are client/player behaviour (owner check).
global.evilEyeShowcaseCheck.checks = global.evilEyeShowcaseCheck.checks || {}
global.evilEyeShowcaseCheck.checks.sophisticated_backpacks = function (h) {
  var check = h.check, later = h.later
  var before = h.shell()
  global.evilEyeShowcaseCheck.terrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(h.shell() === before, 'entire exterior shell unchanged after build')

  ;['sophisticatedbackpacks', 'sophisticatedcore', 'sophisticatedbackpackscreateintegration', 'curios'].forEach(function (id) {
    check(Platform.isLoaded(id), id + ' is loaded')
  })

  var Registries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
  var Rl = Java.loadClass('net.minecraft.resources.ResourceLocation')
  var tiers = ['backpack', 'copper_backpack', 'iron_backpack', 'gold_backpack', 'diamond_backpack', 'netherite_backpack']
  var Tag = Java.loadClass('net.minecraft.tags.TagKey')
  var backTag = Tag.create(Registries.ITEM.key(), Rl.parse('curios:back'))
  tiers.forEach(function (name) {
    var item = Registries.ITEM.get(Rl.parse('sophisticatedbackpacks:' + name))
    check(String(Registries.ITEM.getKey(item)) === 'sophisticatedbackpacks:' + name, name + ' is registered')
    check(item.getDefaultInstance().is(backTag), name + ' is accepted by the Curios back slot (curios:back)')
  })

  // The Curios API reports the slot types the server knows (data-driven, per level).
  var CuriosApi = Java.loadClass('top.theillusivec4.curios.api.CuriosApi')
  var level = h.level
  var slots = CuriosApi.getSlots(false)
  check(slots.containsKey('back'), 'the Curios "back" slot type exists')

  var recipes = level.server.recipeManager
  check(recipes.byKey(Rl.parse('sophisticatedbackpacks:backpack')).isPresent(), 'the basic backpack recipe is present')

  later(5, function () {
    check(h.invoke() === 1, 'rebuild succeeds')
    h.verifyPlan()
    check(h.invoke(null, true) === 1, 'clear command succeeds')
    h.verifyVolume(true)
    check(h.shell() === before, 'entire exterior shell unchanged after teardown')
    h.done()
  })
}
