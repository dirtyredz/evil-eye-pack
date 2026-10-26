// priority: 5
// Resume control from persisted descriptors; section factories are never needed on ticks.
;(function () {
  ServerEvents.tick(function (event) {
    if (event.server.tickCount % 5 !== 0) return
    var ns = global.evilEyeShowcase, records = ns.records(event.server)
    Object.keys(records).forEach(function (key) {
      var r = records[key], level = event.server.getLevel(r.dimension)
      if (level) ns.rigHook(ns.recordRig(r), 'tick', [level, r.origin])
    })
  })
})();
