// priority: 58
// Registers Forge event listeners once per game launch and routes every event through a
// reloadable handler table.
//
// Forge listeners survive /kubejs reload and ForgeEvents is startup-only, so a script
// cannot re-register them. Instead each listener is added to the Forge bus exactly once
// (guarded by a flag on `global`, which persists across reloads) and calls
// global.emiCuration[table][name](event) at event time, so the handlers a reload
// replaces are the ones that run. A throwing handler is logged, never rethrown into Forge.

(function (ns) {
  // flag: the `global` property that marks "already registered".
  // table: the name of the handler table on global.emiCuration (e.g. 'handlers').
  // hooks: [{ event: 'net.minecraftforge...$Post', handler: 'name', label: 'init' }].
  function registerOnce(flag, table, hooks) {
    if (global[flag]) return
    global[flag] = true
    var bus = Java.loadClass('net.minecraftforge.common.MinecraftForge').EVENT_BUS
    var NORMAL = Java.loadClass('net.minecraftforge.eventbus.api.EventPriority').NORMAL
    var hook = function (spec) {
      bus.addListener(NORMAL, false, Java.loadClass(spec.event), function (e) {
        try {
          global.emiCuration[table][spec.handler](e)
        } catch (err) {
          console.error('EMI curation (' + spec.label + ' listener): ' + err)
        }
      })
    }
    for (var i = 0; i < hooks.length; i++) hook(hooks[i])
  }

  ns.forgeHooks = { registerOnce: registerOnce }
})(global.emiCuration || (global.emiCuration = {}))
