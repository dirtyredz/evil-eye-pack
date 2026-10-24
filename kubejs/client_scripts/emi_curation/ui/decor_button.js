// priority: 44
// "DECOR: SHOWN / DECOR: HIDDEN" button beside the CLEAN/ALL and Mods buttons.
//
// Same lifecycle as button.js (placed from EMI's search-bar bounds every frame, hidden with
// the EMI overlay, inactive while EMI loads or decor.json is unusable). It loads after
// button.js (50) and mods_menu.js (45) so it can read both rectangles and settle beside
// them in one pass: Forge calls the Render listeners in registration order, so CLEAN and
// Mods are always placed first and this button never moves them.

(function (ns) {
  var WIDTH = 80
  var H_GAP = 2

  function ui() { return ns.decorUi || (ns.decorUi = { button: null, screen: null }) }

  // Candidate spots, best first: right of Mods, then right of CLEAN. placement.chooseRect
  // tries its own spots (beside the search bar) after these. A spot above the Mods button is
  // deliberately not offered: the Mods dropdown opens there.
  function preferredSpots() {
    var spots = []
    var clean = ns.placement.rect('clean')
    var mods = ns.placement.rect('mods')
    if (mods != null) spots.push({ x: mods.x + mods.w + H_GAP, y: mods.y })
    if (clean != null) spots.push({ x: clean.x + clean.w + H_GAP, y: clean.y })
    return spots
  }

  function update(button, screen) {
    var ctx = ns.placement.usableLayout(screen)
    if (ctx == null) {
      button.visible = false
      return
    }
    var clean = ns.placement.rect('clean')
    var mods = ns.placement.rect('mods')
    if (clean != null) ctx.avoid.push(clean)
    if (mods != null) ctx.avoid.push(mods)
    var r = ns.placement.chooseRect(ctx, WIDTH, preferredSpots())
    button.setX(r.x)
    button.setY(r.y)
    button.setWidth(r.w)
    button.visible = true
    button.active = ns.session.canPressDecor()
    var label = ns.decorState.label()
    if (String(button.getMessage().getString()) !== label) button.setMessage(ns.interop.literal(label))
  }

  function onScreenInit(e) {
    var screen = e.getScreen()
    if (!ns.interop.isContainerScreen(screen)) return
    var Button = ns.interop.cls('net.minecraft.client.gui.components.Button')
    var button = Button.builder(ns.interop.literal(ns.decorState.label()), function (btn) {
      // Resolve through global at press time so reloaded code is used.
      try {
        var cur = global.emiCuration
        cur.session.toggleDecor()
        cur.decorHandlers.refresh(btn)
      } catch (err) {
        try { global.emiCuration.diag.logError('decor press', err) } catch (ignored) {}
      }
    }).bounds(0, 0, WIDTH, 18).build()
    button.visible = false
    e.addListener(button)
    var u = ui()
    u.button = button
    u.screen = screen
    update(button, screen)
  }

  function onScreenRender(e) {
    var u = ui()
    if (u.button == null) return
    var screen = e.getScreen()
    if (!ns.interop.isContainerScreen(screen)) return
    u.screen = screen
    update(u.button, screen)
  }

  function refresh(btn) {
    var u = ui()
    if (u.screen != null) update(btn, u.screen)
  }

  ns.placement.register('decor', function () { return ns.placement.visibleRect(ui().button) })

  ns.decorHandlers = {
    screenInit: function (e) { ns.diag.guard('decor init', function () { onScreenInit(e) }) },
    screenRender: function (e) { ns.diag.guard('decor render', function () { onScreenRender(e) }) },
    refresh: function (btn) { ns.diag.guard('decor refresh', function () { refresh(btn) }) }
  }

  var EV = 'net.minecraftforge.client.event.'
  ns.forgeHooks.registerOnce('emiCurationDecorListeners', 'decorHandlers', [
    { event: EV + 'ScreenEvent$Init$Post', handler: 'screenInit', label: 'decor init' },
    { event: EV + 'ScreenEvent$Render$Pre', handler: 'screenRender', label: 'decor render' }
  ])
})(global.emiCuration || (global.emiCuration = {}))
