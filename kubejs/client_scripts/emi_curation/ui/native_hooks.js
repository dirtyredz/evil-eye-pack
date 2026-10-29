// priority: 58
// Registers NeoForge event listeners through KubeJS 2101's NativeEvents and routes every event through a
// reloadable handler table.
//
// NativeEvents listeners are reloadable: KubeJS drops them on /kubejs reload and the scripts register
// them again, so there is no once-per-launch guard (2101 also forbids client scripts from setting values
// on `global`). Each listener calls global.emiCuration[table][name](event) at event time, so the handler
// a reload installs is the one that runs. A throwing handler is logged, never rethrown into NeoForge.

(function (ns) {
  // table: the name of the handler table on global.emiCuration (e.g. 'handlers').
  // hooks: [{ event: 'net.neoforged.neoforge.client.event...$Post', handler: 'name', label: 'init' }].
  function register(table, hooks) {
    var hook = function (spec) {
      NativeEvents.onEvent(spec.event, function (e) {
        try {
          global.emiCuration[table][spec.handler](e)
        } catch (err) {
          console.error('EMI curation (' + spec.label + ' listener): ' + err)
        }
      })
    }
    for (var i = 0; i < hooks.length; i++) hook(hooks[i])
  }

  ns.nativeHooks = { register: register, EVENTS: 'net.neoforged.neoforge.client.event.' }
})(global.emiCuration || (global.emiCuration = {}))
