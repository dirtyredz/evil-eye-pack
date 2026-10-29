// Pack-test probe startup script (test server only; injected into kubejs/startup_scripts/pack_test/).
// KubeJS 2101 (7.x) only lets startup scripts set values on `global`; the server-side probe sections
// then add their namespaces to this object. Harmless on KubeJS 2001, where server scripts may also set it.
global.packTest = global.packTest || {}
