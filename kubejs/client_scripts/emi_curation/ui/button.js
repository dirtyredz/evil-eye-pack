// priority: 50
// CLEAN/ALL toolbar button. Place before Mods and DECOR (Forge listener order).
(function (ns) {
  ns.makeScreenButton({
    name: ns.placement.CLEAN,
    width: 66,
    label: function () { return ns.session.label() },
    canPress: function () { return ns.session.canPress() },
    onPress: function () { ns.session.toggle() }
  })
})(global.emiCuration || (global.emiCuration = {}))
