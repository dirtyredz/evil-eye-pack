// priority: -10
// Evil Eye equipment panel on the live pack server: the build, the owned menu type the panel opens, and
// Cosmetic Armor Reworked gone (its screen and rendering are replaced). The panel itself is a client screen.
global.evilEyeShowcaseCheck.checks = global.evilEyeShowcaseCheck.checks || {}
global.evilEyeShowcaseCheck.checks.evileye_equipment = function (h) {
  var check = h.check, later = h.later
  var before = h.shell()
  global.evilEyeShowcaseCheck.terrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(h.shell() === before, 'entire exterior shell unchanged after build')

  var Registries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
  var Rl = Java.loadClass('net.minecraft.resources.ResourceLocation')
  check(Registries.MENU.containsKey(Rl.parse('evileye_tweaks:equipment')), 'the server registers the evileye_tweaks:equipment menu type')
  check(Platform.isLoaded('evileye_tweaks'), 'Evil Eye Tweaks is loaded')
  check(!Platform.isLoaded('cosmeticarmorreworked'), 'Cosmetic Armor Reworked is not loaded')

  later(5, function () {
    check(h.invoke() === 1, 'rebuild succeeds')
    h.verifyPlan()
    check(h.invoke(null, true) === 1, 'clear command succeeds')
    h.verifyVolume(true)
    check(h.shell() === before, 'entire exterior shell unchanged after teardown')
    h.done()
  })
}
