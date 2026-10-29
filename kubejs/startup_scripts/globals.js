// priority: 1000
// The shared `global` namespaces. KubeJS 2101 only lets startup scripts set values on `global`, so every
// namespace the client and server scripts extend is created here; they then add their own properties
// (global.emiCuration.<module>, global.evilEyeShowcase.<part>). A change here needs a full restart.
global.emiCuration = global.emiCuration || {}
global.evilEyeShowcase = global.evilEyeShowcase || {}
