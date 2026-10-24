// priority: 44
// DECOR toolbar button. Place after CLEAN (50) and Mods (45), using their live rects.
(function (ns) {
  // Best first: right of Mods, then right of CLEAN. Do not offer a spot above Mods:
  // its dropdown opens there. placement tries its usual search-bar spots afterwards.
  function preferredSpots() {
    var spots = []
    var rects = ns.placement.rects([ns.placement.MODS, ns.placement.CLEAN])
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i]
      spots.push({ x: r.x + r.w + ns.placement.GAP, y: r.y })
    }
    return spots
  }

  ns.makeScreenButton({
    name: ns.placement.DECOR,
    width: 80,
    label: function () { return ns.decorState.label() },
    canPress: function () { return ns.session.canPressDecor() },
    onPress: function () { ns.session.toggleDecor() },
    avoid: [ns.placement.CLEAN, ns.placement.MODS], spots: preferredSpots
  })
})(global.emiCuration || (global.emiCuration = {}))
