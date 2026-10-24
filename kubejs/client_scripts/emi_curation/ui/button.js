// priority: 50
// "EMI: CLEAN / EMI: ALL" button on container and inventory screens.
//
// Placed from EMI's real search-bar bounds and re-placed every frame (placement.js holds
// the shared rules and the reason the per-frame placement is needed). Hidden when the
// EMI overlay is hidden, and until EMI has laid the search bar out; inactive while EMI
// is loading.
//
// Forge listeners survive /kubejs reload, so they are registered once and dispatch
// through global.emiCuration.handlers, which every reload replaces.

(function (ns) {
  var WIDTH = 66

  function chooseRect(ctx) { return ns.placement.chooseRect(ctx, WIDTH) }

  function ui() { return ns.ui || (ns.ui = { button: null, screen: null }) }

  // Positions the button, updates its label/visibility/active state.
  function update(button, screen) {
    var ctx = ns.placement.usableLayout(screen)
    if (ctx == null) {
      button.visible = false
      return
    }
    var r = chooseRect(ctx)
    button.setX(r.x)
    button.setY(r.y)
    button.setWidth(r.w)
    button.visible = true
    button.active = ns.session.canPress()
    var label = ns.session.label()
    if (String(button.getMessage().getString()) !== label) {
      button.setMessage(ns.interop.literal(label))
    }
  }

  function onScreenInit(e) {
    var screen = e.getScreen()
    if (!ns.interop.isContainerScreen(screen)) return
    var Button = ns.interop.cls('net.minecraft.client.gui.components.Button')
    var button = Button.builder(ns.interop.literal(ns.session.label()), function (btn) {
      // Resolve through global at press time so reloaded code is used.
      try {
        var cur = global.emiCuration
        cur.session.toggle()
        cur.handlers.refresh(btn)
      } catch (err) {
        try { global.emiCuration.diag.logError('press', err) } catch (ignored) {}
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
    // Use the event's own screen: Init.Post always precedes the first render of a screen
    // and replaces u.button, so no identity match with the stored screen is needed (and
    // none is trusted: a mismatch here would leave the button where Init.Post put it).
    var screen = e.getScreen()
    if (!ns.interop.isContainerScreen(screen)) return
    u.screen = screen
    update(u.button, screen)
  }

  function refresh(btn) {
    var u = ui()
    if (u.screen != null) update(btn, u.screen)
  }

  ns.placement.register('clean', function () { return ns.placement.visibleRect(ui().button) })

  ns.button = { WIDTH: WIDTH, chooseRect: chooseRect }
  ns.handlers = {
    screenInit: function (e) { ns.diag.guard('screen init', function () { onScreenInit(e) }) },
    screenRender: function (e) { ns.diag.guard('screen render', function () { onScreenRender(e) }) },
    refresh: function (btn) { ns.diag.guard('button refresh', function () { refresh(btn) }) }
  }

  // ForgeEvents is startup-only: register on the Forge bus directly, exactly once.
  var EV = 'net.minecraftforge.client.event.'
  ns.forgeHooks.registerOnce('emiCurationForgeListeners', 'handlers', [
    { event: EV + 'ScreenEvent$Init$Post', handler: 'screenInit', label: 'init' },
    { event: EV + 'ScreenEvent$Render$Pre', handler: 'screenRender', label: 'render' }
  ])
})(global.emiCuration || (global.emiCuration = {}))
