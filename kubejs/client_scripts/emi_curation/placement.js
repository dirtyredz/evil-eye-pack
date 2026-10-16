// priority: 55
// Shared placement helpers for the buttons that sit beside EMI's search bar
// (button.js: CLEAN/ALL, mods_menu.js: Mods). Placed from EMI's real search-bar bounds
// (EmiScreenManager.search); callers re-place every frame. Avoids the container, EMI's
// bottom-left config/tree buttons and every visible EMI sidebar panel.
//
// EmiScreenManager.search is a static field built at (0, 0), and EMI only positions it in
// addWidgets, which its Screen.init mixin runs at the RETURN of init, i.e. after Forge's
// ScreenEvent.Init.Post. So a placement made at Init.Post reads a stale rectangle; the
// per-frame placement is what puts it right (see searchPlaced).

(function (ns) {
  var GAP = 2
  // EMI 1.1.24 EmiScreenManager.addWidgets: config button at x=2 and tree button at
  // x=24, both 20x20 at y = screen height - 22.
  function emiButtonRects(screenH) {
    return [{ x: 2, y: screenH - 22, w: 20, h: 20 }, { x: 24, y: screenH - 22, w: 20, h: 20 }]
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  }

  // True once EMI has positioned its search bar for this screen. The widget is created
  // at (0, 0) and only moved by EmiScreenManager.addWidgets, so a bar at y <= 0, one with
  // no size, or one that does not fit the screen has not been laid out yet.
  function searchPlaced(search, screen) {
    return search.w > 0 && search.h > 0 && search.x >= 0 && search.y > 0 &&
      search.x + search.w <= screen.w && search.y + search.h <= screen.h
  }

  // Pure placement of a `width`-wide button.
  // ctx: { screen:{w,h}, search:{x,y,w,h}, avoid:[rect], isPanelAt(x,y) }
  // preferred: optional [{x,y}] candidates tried before the default ones.
  function chooseRect(ctx, width, preferred) {
    var s = ctx.search
    var h = s.h
    var candidates = (preferred || []).concat([
      { x: s.x - width - GAP, y: s.y },
      { x: s.x + s.w + GAP, y: s.y },
      { x: s.x, y: s.y - h - GAP },
      { x: 46, y: s.y }
    ])
    for (var i = 0; i < candidates.length; i++) {
      var r = { x: candidates[i].x, y: candidates[i].y, w: width, h: h }
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
    var fx = Math.max(0, Math.min(ctx.screen.w - width, s.x - width - GAP))
    var fy = Math.max(0, Math.min(ctx.screen.h - h, s.y))
    return { x: fx, y: fy, w: width, h: h }
  }

  // Reads the live layout for `screen`; null when EMI's search widget does not exist.
  function layoutContext(screen) {
    var I = ns.interop
    var EmiScreenManager = I.cls('dev.emi.emi.screen.EmiScreenManager')
    var search = EmiScreenManager.search
    if (search == null) return null
    var avoid = emiButtonRects(screen.height)
    // The search bar itself: a button "beside" another button must not land on it.
    avoid.push({ x: search.getX(), y: search.getY(), w: search.getWidth(), h: search.getHeight() })
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

  // The layout for `screen` when EMI is enabled and has laid its search bar out, else null.
  function usableLayout(screen) {
    var ctx = layoutContext(screen)
    var EmiConfig = ns.interop.cls('dev.emi.emi.config.EmiConfig')
    if (ctx == null || !EmiConfig.enabled || !ctx.searchVisible || !searchPlaced(ctx.search, ctx.screen)) return null
    return ctx
  }

  ns.placement = {
    GAP: GAP, overlaps: overlaps, emiButtonRects: emiButtonRects, searchPlaced: searchPlaced,
    chooseRect: chooseRect, layoutContext: layoutContext, usableLayout: usableLayout
  }
})(global.emiCuration || (global.emiCuration = {}))
