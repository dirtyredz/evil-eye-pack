// Pack-test probe startup script (test server only; injected into kubejs/startup_scripts/pack_test/).
// KubeJS 2101 (7.x) only lets startup scripts set values on `global`; the server-side probe sections
// then add their namespaces to this object. Harmless on KubeJS 2001, where server scripts may also set it.
global.packTest = global.packTest || {}

// Evidence for runtime.js: does a NativeEvents listener registered with a class-name string fire?
// ServerAboutToStartEvent fires before the probe runs (at ServerEvents.loaded).
;(function () {
  var state = (global.packTest.nativeEvents = { registered: false, fired: false })
  if (typeof NativeEvents === 'undefined') { state.error = 'NativeEvents is not defined (KubeJS before 2101)'; return }
  try {
    NativeEvents.onEvent('net.neoforged.neoforge.event.server.ServerAboutToStartEvent', function () { state.fired = true })
    state.registered = true
  } catch (e) { state.error = String(e).slice(0, 300) }
})()
