// priority: 54
// Shared CLEAN/DECOR widget lifecycle. Widgets and Forge listeners survive script reloads;
// callbacks dispatch through the current handler table, and all Java callbacks are guarded.

(function (ns) {
  function makeScreenButton(opts) {
    // Preserve the existing global keys so listeners and widgets survive reloads.
    var clean = opts.name === ns.placement.CLEAN
    var state = clean ? 'ui' : opts.name + 'Ui'
    var handlers = clean ? 'handlers' : opts.name + 'Handlers'
    var flag = 'emiCuration' + (clean ? 'Forge' : opts.name.charAt(0).toUpperCase() + opts.name.slice(1)) + 'Listeners'
    function ui() { return ns[state] || (ns[state] = { button: null, screen: null }) }

    function chooseRect(ctx) {
      var avoid = ns.placement.rects(opts.avoid || [])
      for (var i = 0; i < avoid.length; i++) ctx.avoid.push(avoid[i])
      return ns.placement.chooseRect(ctx, opts.width, opts.spots ? opts.spots(ctx) : [])
    }

    function update(button, screen) {
      var ctx = ns.placement.usableLayout(screen)
      if (ctx == null) { button.visible = false; return }
      var r = chooseRect(ctx)
      button.setX(r.x)
      button.setY(r.y)
      button.setWidth(r.w)
      button.visible = true
      button.active = opts.canPress()
      var label = opts.label()
      if (String(button.getMessage().getString()) !== label) button.setMessage(ns.interop.literal(label))
    }

    function onScreenInit(e) {
      var screen = e.getScreen()
      if (!ns.interop.isContainerScreen(screen)) return
      var Button = ns.interop.cls('net.minecraft.client.gui.components.Button')
      var button = Button.builder(ns.interop.literal(opts.label()), function (btn) {
        try { global.emiCuration[handlers].press(btn) } catch (err) {
          try { global.emiCuration.diag.logError(opts.name + ' press', err) } catch (ignored) {}
        }
      }).bounds(0, 0, opts.width, 18).build()
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
      // Use the event's screen, not wrapper identity: Init.Post replaced the widget.
      var screen = e.getScreen()
      if (!ns.interop.isContainerScreen(screen)) return
      u.screen = screen
      update(u.button, screen)
    }

    function refresh(btn) {
      var u = ui()
      if (u.screen != null) update(btn, u.screen)
    }

    ns.placement.register(opts.name, function () { return ns.placement.visibleRect(ui().button) })
    ns[handlers] = {
      screenInit: function (e) { ns.diag.guard(opts.name + ' init', function () { onScreenInit(e) }) },
      screenRender: function (e) { ns.diag.guard(opts.name + ' render', function () { onScreenRender(e) }) },
      refresh: function (btn) { ns.diag.guard(opts.name + ' refresh', function () { refresh(btn) }) },
      press: function (btn) {
        ns.diag.guard(opts.name + ' press', function () {
          opts.onPress()
          ns[handlers].refresh(btn)
        })
      }
    }
    var EV = 'net.minecraftforge.client.event.'
    ns.forgeHooks.registerOnce(flag, handlers, [
      { event: EV + 'ScreenEvent$Init$Post', handler: 'screenInit', label: opts.name + ' init' },
      { event: EV + 'ScreenEvent$Render$Pre', handler: 'screenRender', label: opts.name + ' render' }
    ])
  }

  ns.makeScreenButton = makeScreenButton
})(global.emiCuration || (global.emiCuration = {}))
