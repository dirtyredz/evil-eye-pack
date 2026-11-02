// Showcase check startup script (injected into the disposable check server only).
// KubeJS 2101 lets only startup scripts set values on `global`; the check scripts add their functions
// to this object. Harmless on KubeJS 2001.
global.evilEyeShowcaseCheck = global.evilEyeShowcaseCheck || {}
