// priority: 15
// Entity policy for plot clearing: remove what is ordinary, refuse only for what is not.
;(function () {
  var ns = global.evilEyeShowcase
  function where(e) { return Math.round(e.getX()) + ', ' + Math.round(e.getY()) + ', ' + Math.round(e.getZ()) }
  // The showcase's own glue and contraption entities are not "mobs" worth reporting.
  function ownRig(type) { return Object.keys(ns.rigs).some(function (key) { var rig = ns.rigs[key]; return rig.ownEntity && rig.ownEntity(type) }) }
  ns.sweepEntities = function (level, box) {
    var found = level.getEntities(null, box), blocking = [], removable = [], counts = {}, total = 0
    for (var i = 0; i < found.size(); i++) {
      var e = found.get(i), type = String(e.getType()), why = ''
      if (type === 'minecraft:player') why = 'a player'
      else if (e.hasCustomName()) why = 'the named ' + type + ' "' + String(e.getCustomName().getString()) + '"'
      else if (typeof e.getOwnerUUID === 'function' && e.getOwnerUUID() !== null) why = 'an owned/tamed ' + type
      if (why) { blocking.push(why + ' at ' + where(e)); continue }
      removable.push(e)
      if (!ownRig(type)) { counts[type] = (counts[type] || 0) + 1; total++ }
    }
    var parts = Object.keys(counts).sort().map(function (t) { return counts[t] + ' ' + t })
    return { blocking: blocking, removable: removable, report: { total: total, summary: parts.join(', ') } }
  }
})();
