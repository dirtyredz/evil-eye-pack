// priority: 50
// "EMI: CLEAN / EMI: ALL" button on container and inventory screens.
//
// Placed from EMI's real search-bar bounds (EmiScreenManager.search) and re-placed every
// frame, so resizes and layout changes are followed. It avoids the container, EMI's
// bottom-left config/tree buttons and every visible EMI sidebar panel. Hidden when the
// EMI overlay is hidden; inactive while EMI is loading.
//
// Forge listeners survive /kubejs reload, so they are registered once and dispatch
// through global.emiCuration.handlers, which every reload replaces.

(function (ns) {
  var WIDTH = 66
  var GAP = 2
  // EMI 1.1.24 EmiScreenManager.addWidgets: config button at x=2 and tree button at
  // x=24, both 20x20 at y = screen height - 22.
  function emiButtonRects(screenH) {
    return [{ x: 2, y: screenH - 22, w: 20, h: 20 }, { x: 24, y: screenH - 22, w: 20, h: 20 }]
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  }

  // Pure placement. ctx: { screen:{w,h}, search:{x,y,w,h}, avoid:[rect], isPanelAt(x,y) }
  function chooseRect(ctx) {
    var s = ctx.search
    var h = s.h
    var candidates = [
      { x: s.x - WIDTH - GAP, y: s.y },
      { x: s.x + s.w + GAP, y: s.y },
      { x: s.x, y: s.y - h - GAP },
      { x: 46, y: s.y }
    ]
    for (var i = 0; i < candidates.length; i++) {
      var r = { x: candidates[i].x, y: candidates[i].y, w: WIDTH, h: h }
      if (r.x < 0 || r.y < 0 || r.x + r.w > ctx.screen.w || r.y + r.h > ctx.screen.h) continue
      var blocked = false
      for (var a = 0; a < ctx.avoid.length; a++) {
        if (overlaps(r, ctx.avoid[a])) { blocked = true; break }
      }
      if (!blocked && ctx.isPanelAt) {
        blocked = ctx.isPanelAt(r.x, r.y) || ctx.isPanelAt(r.x + r.w - 1, r.y) ||
          ctx.isPanelAt(r.x, r.y + r.h - 1) || ctx.isPanelAt(r.x + r.w - 1, r.y + r.h - 1)
      }
      if (!blocked) return r
    }
    // Nothing is free: keep it left of the search bar, clamped on screen.
    var fx = Math.max(0, Math.min(ctx.screen.w - WIDTH, s.x - WIDTH - GAP))
    var fy = Math.max(0, Math.min(ctx.screen.h - h, s.y))
    return { x: fx, y: fy, w: WIDTH, h: h }
  }

  function layoutContext(screen) {
    var I = ns.interop
    var EmiScreenManager = I.cls('dev.emi.emi.screen.EmiScreenManager')
    var search = EmiScreenManager.search
    if (search == null) return null
    var avoid = emiButtonRects(screen.height)
    var Container = I.cls('net.minecraft.client.gui.screens.inventory.AbstractContainerScreen')
    if (screen instanceof Container) {
      // The creative inventory draws its tab rows outside the container image.
      var Creative = I.cls('net.minecraft.client.gui.screens.inventory.CreativeModeInventoryScreen')
      var tabs = screen instanceof Creative ? 32 : 0
      avoid.push({ x: screen.getGuiLeft(), y: screen.getGuiTop() - tabs, w: screen.getXSize(), h: screen.getYSize() + 2 * tabs })
    }
    return {
      screen: { w: screen.width, h: screen.height },
      search: { x: search.getX(), y: search.getY(), w: search.getWidth(), h: search.getHeight() },
      searchVisible: search.isVisible(),
      avoid: avoid,
      isPanelAt: function (x, y) { return EmiScreenManager.getHoveredPanel(x, y) != null }
    }
  }

  function ui() { return ns.ui || (ns.ui = { button: null, screen: null }) }

  // Positions the button, updates its label/visibility/active state.
  function update(button, screen) {
    var ctx = layoutContext(screen)
    var EmiConfig = ns.interop.cls('dev.emi.emi.config.EmiConfig')
    if (ctx == null || !EmiConfig.enabled || !ctx.searchVisible) {
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
      button.setMessage(ns.interop.cls('net.minecraft.network.chat.Component').literal(label))
    }
  }

  function onScreenInit(e) {
    var I = ns.interop
    var screen = e.getScreen()
    var Container = I.cls('net.minecraft.client.gui.screens.inventory.AbstractContainerScreen')
    if (!(screen instanceof Container)) return
    var Component = I.cls('net.minecraft.network.chat.Component')
    var Button = I.cls('net.minecraft.client.gui.components.Button')
    var button = Button.builder(Component.literal(ns.session.label()), function (btn) {
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
    if (u.button == null || !ns.interop.sameRef(e.getScreen(), u.screen)) return
    update(u.button, u.screen)
  }

  function refresh(btn) {
    var u = ui()
    if (u.screen != null) update(btn, u.screen)
  }

  ns.button = { WIDTH: WIDTH, chooseRect: chooseRect, emiButtonRects: emiButtonRects }
  ns.handlers = {
    screenInit: function (e) { ns.diag.guard('screen init', function () { onScreenInit(e) }) },
    screenRender: function (e) { ns.diag.guard('screen render', function () { onScreenRender(e) }) },
    refresh: function (btn) { ns.diag.guard('button refresh', function () { refresh(btn) }) }
  }

  // ForgeEvents is startup-only: register on the Forge bus directly, exactly once.
  if (!global.emiCurationForgeListeners) {
    global.emiCurationForgeListeners = true
    var bus = Java.loadClass('net.minecraftforge.common.MinecraftForge').EVENT_BUS
    var NORMAL = Java.loadClass('net.minecraftforge.eventbus.api.EventPriority').NORMAL
    bus.addListener(NORMAL, false, Java.loadClass('net.minecraftforge.client.event.ScreenEvent$Init$Post'), function (e) {
      try { global.emiCuration.handlers.screenInit(e) } catch (err) { console.error('EMI curation (init listener): ' + err) }
    })
    bus.addListener(NORMAL, false, Java.loadClass('net.minecraftforge.client.event.ScreenEvent$Render$Pre'), function (e) {
      try { global.emiCuration.handlers.screenRender(e) } catch (err) { console.error('EMI curation (render listener): ' + err) }
    })
  }
})(global.emiCuration || (global.emiCuration = {}))
