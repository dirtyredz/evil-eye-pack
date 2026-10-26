// priority: -6
// One registry-wide command contract per run, independent of the selected section checks.
global.evilEyeShowcaseCommandForms = function (h) {
  var ns = global.evilEyeShowcase, names = Object.keys(ns.sections).sort(), check = h.check
  var Vec3 = Java.loadClass('net.minecraft.world.phys.Vec3'), Vec2 = Java.loadClass('net.minecraft.world.phys.Vec2')
  var plans = names.map(function (name) { return ns.sections[name]() })
  var source = h.server.createCommandSourceStack().withPosition(new Vec3(512, 240, 252)).withRotation(new Vec2(0, 0)).withPermission(2)
  var layout = ns.layout(plans, source)
  function run(text, who) { return h.server.getCommands().performPrefixedCommand(who || source, text) }
  var fixtures = names.map(function (name, i) {
    var o = layout.origins[i]
    return global.evilEyeShowcaseMakeHelpers({ server: h.server, level: h.level, name: name, plan: plans[i], origin: o, check: check,
      source: source.withPosition(new Vec3(o.x + Math.floor(plans[i].width / 2), o.y, o.z - 4)) })
  })
  fixtures.forEach(function (f) { f.prepareTerrain() })
  h.later(20, function () {
    var before = fixtures.map(function (f) { return f.shell() })
    var recordsBefore = Object.keys(ns.records(h.server)).length
    check(run('evileye showcase', source.withPermission(1)) === 0, 'bare command denied below permission level 2')
    fixtures.forEach(function (f) { check(f.invoke(f.source.withPermission(1)) === 0, 'permission level 1 denied for ' + f.name) })
    check(run('evileye showcase nope') === 0, 'unknown section name refused with the friendly message')
    check(run('evileye showcase ' + names[0] + ' extra') === 0, 'extra words refused')
    check(run('evileye showcase clear nope') === 0, 'clear of unknown section refused')
    check(run('evileye showcase list') === 1, 'list command succeeds')
    check(run('evileye showcase') === 1, 'bare /evileye showcase builds at the issuing position')
    fixtures.forEach(function (f) { f.verifyPlan() })
    check(Object.keys(ns.records(h.server)).length === recordsBefore + names.length, 'bare build records every registered section')
    fixtures.forEach(function (f) {
      check(run('evileye showcase ' + f.name + ' ', f.source) === 1, 'named command with trailing space rebuilds ' + f.name)
      f.verifyPlan()
    })
    check(run('evileye showcase list ') === 1, 'list with trailing space succeeds')
    check(run('evileye showcase clear') === 1, 'bare clear removes every registered section')
    fixtures.forEach(function (f, i) { f.verifyVolume(true); check(f.shell() === before[i], 'entire exterior shell unchanged after command-form checks for ' + f.name) })
    check(Object.keys(ns.records(h.server)).length === recordsBefore, 'bare clear leaves no new plot records')
    // A second clear must refuse without changing the already cleared volume.
    check(run('evileye showcase clear') === 0, 'clear of unowned row refuses')
    fixtures.forEach(function (f) { f.verifyVolume(true) })
    h.done()
  })
}
