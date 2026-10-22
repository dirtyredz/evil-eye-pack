// priority: 45
// "Mods" dropdown beside the CLEAN/ALL button. Choosing a mod sets EMI's search text to
// "@<modid>" (exactly as if the player typed it), choosing the active mod again or
// "Clear" empties it. A click outside the menu or Esc closes it without changing
// anything. The list is built when the menu opens: every loaded mod that owns at least one
// item in EMI's current index (so CLEAN and DECOR changes show), sorted A-Z by display name,
// with config/emi-curation/mods.json applying renames, hides and pins. A list too long for
// the screen is split into pages (a Prev / Next strip next to the button).
//
// Only the Mods button is a widget. The dropdown is drawn by this script in Render$Post
// (above EMI's panels) and hit-tested from the mouse-press hook. The search is
// set with EmiScreenManager.search.setValue(...): EditBox.setValue runs the widget's
// responder, which is what makes EMI refilter (the same path as typing).
//
// Forge listeners survive /kubejs reload, so they are registered once and dispatch
// through global.emiCuration.modsMenuHandlers, which every reload replaces.

(function (ns) {
  var L = ns.modsList
  var G = ns.modsLayout
  var BUTTON_W = 46
  var BUTTON_LABEL = 'Mods ▾'
  var PAD = 4
  var CLEAR_LABEL = 'Clear'
  var PREV_LABEL = '< Prev'
  var ESC = 256

  // ---- state ----

  // u.items: [{label, modid}] (modid null = Clear). While open, u.rows holds what is on the
  // current page, [{kind: 'item'|'prev'|'next', index, rect}], and u.rects their rects.
  function ui() {
    return ns.modsUi || (ns.modsUi = { screen: null, button: null, items: [], rows: [], rects: [], open: false, mouse: null, page: 0, pageCount: 1 })
  }

  function menuItems() {
    var items = [{ label: CLEAR_LABEL, modid: null }]
    var entries = ns.modsSource.entries()
    for (var i = 0; i < entries.length; i++) items.push({ label: entries[i].label, modid: entries[i].modid })
    return items
  }

  function searchWidget() { return ns.emiScreen.searchWidget() }

  function currentSearch() {
    var w = searchWidget()
    return w == null ? '' : String(w.getValue())
  }

  function rectOf(w) { return { x: w.getX(), y: w.getY(), w: w.getWidth(), h: w.getHeight() } }

  // Row text as drawn (the active mod is marked with a leading "> ").
  function rowText(item, cur) {
    return (item.modid !== null && L.isActive(cur, item.modid) ? '> ' : '') + item.label
  }

  // Pixel width of each row, measured with the "> " marker included so a row never changes
  // width when it becomes active.
  function measureRows(u) {
    var widths = []
    for (var i = 0; i < u.items.length; i++) widths.push(ns.modsText.width('> ' + u.items[i].label) + 2 * PAD)
    return widths
  }

  function layoutItems(u) {
    if (!u.widths || u.widths.length !== u.items.length) u.widths = measureRows(u)
    var lay = G.layoutPaged(rectOf(u.button), u.widths, { w: u.screen.width, h: u.screen.height }, u.page)
    u.page = lay.page
    u.pageCount = lay.pageCount
    var rows = []
    for (var i = 0; i < lay.rows.length; i++) rows.push({ kind: 'item', index: lay.rows[i].index, rect: lay.rows[i].rect })
    if (lay.pager) {
      rows.push({ kind: 'prev', index: -1, rect: lay.pager.prev })
      rows.push({ kind: 'next', index: -1, rect: lay.pager.next })
    }
    var rects = []
    for (var j = 0; j < rows.length; j++) rects.push(rows[j].rect)
    // Never cover the other buttons (CLEAN, DECOR): slide the dropdown sideways if it would.
    var dx = G.shiftClear(rects, otherButtons(), u.screen.width)
    for (var k = 0; k < rects.length; k++) {
      if (dx !== 0) rows[k].rect = { x: rects[k].x + dx, y: rects[k].y, w: rects[k].w, h: rects[k].h }
    }
    u.rows = rows
    u.rects = []
    for (var n = 0; n < rows.length; n++) u.rects.push(rows[n].rect)
  }

  // Rects of the visible CLEAN and DECOR buttons.
  function otherButtons() {
    var out = []
    var others = [ns.ui ? ns.ui.button : null, ns.decorUi ? ns.decorUi.button : null]
    for (var i = 0; i < others.length; i++) if (others[i] != null && others[i].visible) out.push(rectOf(others[i]))
    return out
  }

  function setOpen(u, open) {
    u.open = open
    u.rows = []
    u.rects = []
    u.page = 0
    if (open) {
      u.items = menuItems()
      u.widths = null
      layoutItems(u)
    }
  }

  // Prev / Next wrap around.
  function turnPage(u, delta) {
    u.page = (u.page + delta + u.pageCount) % u.pageCount
    layoutItems(u)
  }

  function rowLabel(u, row, cur) {
    if (row.kind === 'prev') return PREV_LABEL
    if (row.kind === 'next') return 'Next > ' + (u.page + 1) + '/' + u.pageCount
    return rowText(u.items[row.index], cur)
  }

  function rowActive(u, row, cur) {
    if (row.kind !== 'item') return false
    var item = u.items[row.index]
    return item.modid !== null && L.isActive(cur, item.modid)
  }

  function choose(modid) {
    var u = ui()
    var w = searchWidget()
    if (w != null) w.setValue(modid === null ? '' : L.nextSearch(String(w.getValue()), modid))
    setOpen(u, false)
  }

  function toggle() {
    var u = ui()
    if (u.button != null) setOpen(u, !u.open)
  }

  function rowAt(u, x, y) {
    for (var i = 0; i < u.rows.length; i++) if (G.inside(u.rows[i].rect, x, y)) return i
    return -1
  }

  // Where the Mods button goes first: beside the CLEAN/ALL button, on the side away from
  // the search bar's centre line it already occupies.
  function preferredSpots(ctx, clean) {
    if (!clean || !clean.visible) return []
    var gap = ns.placement.GAP
    var left = { x: clean.getX() - BUTTON_W - gap, y: clean.getY() }
    var right = { x: clean.getX() + clean.getWidth() + gap, y: clean.getY() }
    return clean.getX() < ctx.search.x ? [left, right] : [right, left]
  }

  // Positions the Mods button; hides it (and closes the menu) when EMI is unusable.
  function update(u, screen) {
    var ctx = ns.placement.usableLayout(screen)
    if (ctx == null) {
      u.button.visible = false
      if (u.open) setOpen(u, false)
      return
    }
    var clean = ns.ui ? ns.ui.button : null
    if (clean && clean.visible) ctx.avoid.push(rectOf(clean))
    var r = ns.placement.chooseRect(ctx, BUTTON_W, preferredSpots(ctx, clean))
    u.button.setX(r.x)
    u.button.setY(r.y)
    u.button.setWidth(r.w)
    u.button.visible = true
    u.button.active = ns.session.canPress()
    if (!u.button.active && u.open) setOpen(u, false)
    if (u.open) layoutItems(u)
  }

  // Logs each failure site once per script load, never per frame.
  var reported = {}
  function logOnce(where, err) {
    if (reported[where]) return
    reported[where] = true
    ns.diag.logError(where, err)
  }

  // ---- drawing ----
  // The dropdown is drawn by this script in Render$Post, after the screen, EMI's panels
  // and tooltips, so nothing can cover it (Button widgets added at Init.Post are drawn
  // with the screen and EMI's sidebar panels paint over them).

  var COLOR_BACK = 0xF0101018 | 0
  var COLOR_HOVER = 0xFF3A3A5C | 0
  var COLOR_ACTIVE = 0xFF2E4A2E | 0
  var COLOR_TEXT = 0xFFFFFFFF | 0
  var COLOR_BORDER = 0xFF8080A0 | 0
  var DRAW_Z = 600

  function drawMenu(g, u, mouseX, mouseY) {
    var font = ns.interop.cls('net.minecraft.client.Minecraft').getInstance().font
    var cur = currentSearch()
    var hover = rowAt(u, mouseX, mouseY)
    var bounds = { x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9 }
    for (var i = 0; i < u.rows.length; i++) {
      var r = u.rows[i].rect
      bounds.x1 = Math.min(bounds.x1, r.x); bounds.y1 = Math.min(bounds.y1, r.y)
      bounds.x2 = Math.max(bounds.x2, r.x + r.w); bounds.y2 = Math.max(bounds.y2, r.y + r.h)
    }
    g.pose().pushPose()
    try {
      g.pose().translate(0, 0, DRAW_Z)
      g.fill(bounds.x1 - 1, bounds.y1 - 1, bounds.x2 + 1, bounds.y2 + 1, COLOR_BORDER)
      for (var j = 0; j < u.rows.length; j++) {
        var rr = u.rows[j].rect
        g.fill(rr.x, rr.y, rr.x + rr.w, rr.y + rr.h, j === hover ? COLOR_HOVER : (rowActive(u, u.rows[j], cur) ? COLOR_ACTIVE : COLOR_BACK))
      }
      g.flush()
      // Text via ns.modsText (drawWordWrap, opaque ARGB colour), above the fills.
      g.pose().translate(0, 0, 50)
      for (var k = 0; k < u.rows.length; k++) {
        var rk = u.rows[k].rect
        ns.modsText.draw(g, font, rowLabel(u, u.rows[k], cur), rk.x + PAD, rk.y + 2, COLOR_TEXT)
      }
      g.flush()
    } finally {
      g.pose().popPose()
    }
  }

  // ---- Forge event handlers ----

  function onScreenInit(e) {
    var screen = e.getScreen()
    if (!ns.interop.isContainerScreen(screen)) return
    var Button = ns.interop.cls('net.minecraft.client.gui.components.Button')
    var u = ui()
    var button = Button.builder(ns.interop.literal(BUTTON_LABEL), function () {
      try { global.emiCuration.modsMenuHandlers.toggle() } catch (err) {
        try { global.emiCuration.diag.logError('mods press', err) } catch (ignored) {}
      }
    }).bounds(0, 0, BUTTON_W, 18).build()
    button.visible = false
    u.screen = screen
    u.button = button
    u.items = []
    u.rows = []
    u.rects = []
    u.open = false
    e.addListener(button)
    update(u, screen)
  }

  function onScreenRender(e) {
    var u = ui()
    if (u.button == null) return
    // Use the event's own screen (see button.js: no identity match is trusted).
    var screen = e.getScreen()
    if (!ns.interop.isContainerScreen(screen)) return
    u.screen = screen
    u.mouse = { x: e.getMouseX(), y: e.getMouseY() }
    update(u, screen)
  }

  function onScreenPost(e) {
    var u = ui()
    if (!u.open || u.rows.length === 0) return
    if (!ns.interop.isContainerScreen(e.getScreen())) return
    try {
      drawMenu(e.getGuiGraphics(), u, e.getMouseX(), e.getMouseY())
    } catch (err) {
      // Logged once; the menu stays open and drawing is retried next frame.
      logOnce('mods draw', err)
    }
  }

  // While the menu is open and the mouse is over it, the screen and EMI underneath still
  // think they are hovered. Both the container's and EMI's tooltips go through
  // GuiGraphics.renderTooltipInternal (EMI's DrawContextAccessor.drawTooltip invokes it),
  // where Forge posts RenderTooltipEvent.Pre; cancelling that event drops the tooltip.
  function onTooltip(e) {
    var u = ui()
    if (!u.open || !u.mouse || rowAt(u, u.mouse.x, u.mouse.y) < 0) return
    e.setCanceled(true)
  }

  // While open: a left click on a row chooses it; a click on the Mods button is left to the
  // button (it toggles); any other click closes the menu and passes through unconsumed.
  function onMousePressed(e) {
    var u = ui()
    if (!u.open) return
    var x = e.getMouseX()
    var y = e.getMouseY()
    var row = rowAt(u, x, y)
    if (row >= 0) {
      e.setCanceled(true)
      if (e.getButton() !== 0) return
      var hit = u.rows[row]
      if (hit.kind === 'prev') turnPage(u, -1)
      else if (hit.kind === 'next') turnPage(u, 1)
      else choose(u.items[hit.index].modid)
      return
    }
    if (G.inside(rectOf(u.button), x, y)) return
    setOpen(u, false)
  }

  // Esc closes the menu and is consumed, so it does not also close the screen.
  function onKeyPressed(e) {
    var u = ui()
    if (!u.open || e.getKeyCode() !== ESC) return
    setOpen(u, false)
    e.setCanceled(true)
  }

  ns.modsMenuHandlers = {
    screenInit: function (e) { ns.diag.guard('mods init', function () { onScreenInit(e) }) },
    screenRender: function (e) { ns.diag.guard('mods render', function () { onScreenRender(e) }) },
    screenPost: function (e) { ns.diag.guard('mods post', function () { onScreenPost(e) }) },
    tooltip: function (e) { ns.diag.guard('mods tooltip', function () { onTooltip(e) }) },
    mousePressed: function (e) { ns.diag.guard('mods mouse', function () { onMousePressed(e) }) },
    keyPressed: function (e) { ns.diag.guard('mods key', function () { onKeyPressed(e) }) },
    toggle: function () { ns.diag.guard('mods toggle', toggle) },
    choose: function (modid) { ns.diag.guard('mods choose', function () { choose(modid) }) }
  }

  // ForgeEvents is startup-only: register on the Forge bus directly, exactly once.
  var EV = 'net.minecraftforge.client.event.'
  ns.forgeHooks.registerOnce('emiCurationModsListeners', 'modsMenuHandlers', [
    { event: EV + 'ScreenEvent$Init$Post', handler: 'screenInit', label: 'mods screenInit' },
    { event: EV + 'ScreenEvent$Render$Pre', handler: 'screenRender', label: 'mods screenRender' },
    { event: EV + 'ScreenEvent$Render$Post', handler: 'screenPost', label: 'mods screenPost' },
    { event: EV + 'RenderTooltipEvent$Pre', handler: 'tooltip', label: 'mods tooltip' },
    { event: EV + 'ScreenEvent$MouseButtonPressed$Pre', handler: 'mousePressed', label: 'mods mousePressed' },
    { event: EV + 'ScreenEvent$KeyPressed$Pre', handler: 'keyPressed', label: 'mods keyPressed' }
  ])
})(global.emiCuration || (global.emiCuration = {}))
