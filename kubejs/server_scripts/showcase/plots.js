// priority: 18
// Persistent plot ownership and overlap, independent of section mechanics.
;(function () {
  var ns = global.evilEyeShowcase
  ns.records = function (server) {
    var text = String(server.persistentData.getString('evilEyeShowcasePlots'))
    return text ? JSON.parse(text) : {}
  }
  ns.saveRecords = function (server, records) { server.persistentData.putString('evilEyeShowcasePlots', JSON.stringify(records)) }
  ns.plotKey = function (level, o) { return String(level.dimension) + ':' + o.x + ',' + o.y + ',' + o.z }
  ns.recordRig = function (record) {
    if (record.rig) return record.rig
    var keys = Object.keys(ns.rigs)
    for (var i = 0; i < keys.length; i++) {
      var rig = ns.rigs[keys[i]], recovered = rig.legacyRecord && rig.legacyRecord(record)
      if (recovered) return recovered
    }
    return null
  }
  ns.reservePlot = function (server, records, key, level, p, o, name) {
    Object.keys(records).forEach(function (k) {
      var r = records[k]
      if (k !== key && r.dimension === String(level.dimension) && o.x < r.origin.x + r.width && o.x + p.width > r.origin.x && o.z < r.origin.z + r.depth && o.z + p.depth > r.origin.z && o.y - 1 < r.origin.y + r.height && o.y + p.height > r.origin.y - 1) delete records[k]
    })
    records[key] = { name: name, dimension: String(level.dimension), origin: o, width: p.width, depth: p.depth, height: p.height, rig: p.rig || null }
    ns.saveRecords(server, records)
  }
})();
