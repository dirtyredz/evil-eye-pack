// priority: -10
global.evilEyeShowcaseCheck.checks = global.evilEyeShowcaseCheck.checks || {}
global.evilEyeShowcaseCheck.checks.mekanism_machines = function (h) {
  var check = h.check, later = h.later, amount = h.amount
  var before = h.shell()
  // Stored Joules of a Mekanism block entity (its own energy containers, side-independent).
  function joules(x, y, z) {
    var containers = h.be(x, y, z).getEnergyContainers(null), total = 0
    for (var i = 0; i < containers.size(); i++) total += Number(containers.get(i).getEnergy())
    return total
  }
  global.evilEyeShowcaseCheck.terrain(h)
  check(h.invoke() === 1, 'level 2 builds through real command')
  h.verifyPlan()
  check(h.shell() === before, 'entire exterior shell unchanged after build')
  check(joules(1, 0, 5) > 1e18, 'creative energy cube is placed full')
  var ticks = 0
  function poll() { later(5, function () {
    var enriched = amount(h.handler(3, 0, 4), 'enderio:powdered_iron'), crushed = amount(h.handler(7, 0, 4), 'enderio:powdered_iron')
    var generated = joules(12, 0, 4)
    if (enriched >= 4 && crushed >= 2 && generated > 0) {
      check(joules(3, 0, 4) > 0 && joules(7, 0, 4) > 0, 'cable carries creative cube power into both machines')
      check(enriched >= 4 && amount(h.handler(3, 0, 4), 'mekanism:dust_iron') === 0, 'enrichment chamber doubles iron ore into the Ender IO dust survivor, never Mekanism dust')
      check(amount(h.handler(3, 0, 4), 'minecraft:iron_ore') < 16, 'enrichment chamber consumed ore')
      check(crushed >= 2 && amount(h.handler(7, 0, 4), 'mekanism:dust_iron') === 0, 'crusher turns ingots into the Ender IO dust survivor')
      check(generated > 0 && amount(h.handler(12, 0, 4), 'minecraft:coal') < 32, 'heat generator burns coal into stored energy')
      check(joules(1, 0, 5) > 1e18, 'creative cube stays full while supplying')
      check(h.shell() === before, 'entire exterior shell unchanged while machines run')
      check(h.invoke() === 1, 'running section rebuild succeeds')
      h.verifyPlan()
      check(amount(h.handler(3, 0, 4), 'enderio:powdered_iron') === 0, 'rebuild resets machine contents to the plan')
      check(h.invoke(null, true) === 1, 'clear command succeeds')
      h.verifyVolume(true)
      check(h.shell() === before, 'entire exterior shell unchanged after teardown')
      h.done()
    } else if ((ticks += 5) >= 1200) throw new Error('Mekanism processing timeout: enriched=' + enriched + ' crushed=' + crushed + ' generated=' + generated + ' chamber J=' + joules(3, 0, 4))
    else poll()
  }) }
  poll()
}
