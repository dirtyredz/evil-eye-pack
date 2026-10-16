// priority: 45
// "Mods" dropdown beside the CLEAN/ALL button. Choosing a mod sets EMI's search text to
// "@<modid>" (exactly as if the player typed it), choosing the active mod again or
// "Clear" empties it. A click outside the menu or Esc closes it without changing
// anything. The mod list is config/emi-curation/mods.json ([{label, modid}]); entries
// whose mod is not loaded are dropped.
//
// Only the Mods button is a widget. The dropdown is drawn by this script in Render$Post
// (above EMI's panels) and hit-tested from the mouse-press hook. The search is
// set with EmiScreenManager.search.setValue(...): EditBox.setValue runs the widget's
// responder, which is what makes EMI refilter (the same path as typing).
//
// Forge listeners survive /kubejs reload, so they are registered once and dispatch
// through global.emiCuration.modsMenuHandlers, which every reload replaces.

(function (ns) {
  var LIST_PATH = 'config/emi-curation/mods.json'
  var BUTTON_W = 56
  var BUTTON_LABEL = 'Mods ▾'
  var ROW_H = 12
  var PAD = 4
  var CLEAR_LABEL = 'Clear'
  var ESC = 256

  // ---- pure logic ----

  // Parses mods.json text into [{label, modid}], dropping malformed and duplicate entries.
  function parseList(text) {
    var raw = JSON.parse(String(text))
    var out = []
    var seen = {}
    if (!Array.isArray(raw)) throw new Error('mods.json must be an array')
    for (var i = 0; i < raw.length; i++) {
      var e = raw[i]
      if (!e || typeof e.label !== 'string' || typeof e.modid !== 'string') continue
      var label = e.label.trim()
      var modid = e.modid.trim()
      if (label === '' || !/^[a-z0-9_]+$/.test(modid) || seen[modid]) continue
      seen[modid] = true
      out.push({ label: label, modid: modid })
    }
    return out
  }

  function visibleEntries(list, isLoaded) {
    var out = []
    for (var i = 0; i < list.length; i++) if (isLoaded(list[i].modid)) out.push(list[i])
    return out
  }

  function searchText(modid) { return '@' + modid }

  function isActive(current, modid) {
    return String(current).trim().toLowerCase() === searchText(modid)
  }

  // The search text to set when `modid` is chosen: the active mod toggles back to empty.
  function nextSearch(current, modid) {
    return isActive(current, modid) ? '' : searchText(modid)
  }

  // Pure menu layout. anchor: the Mods button rect; widths: each row's width. Returns
  // { rects:[{x,y,w,h}] }, one per row. Rows stack in one column opened upward when the
  // anchor is in the lower half of the screen (downward otherwise); extra columns are
  // used only when the height runs out. Each column is as wide as its own longest row,
  // and the whole menu is clamped to the screen.
  function layoutMenu(anchor, widths, screen) {
    var count = widths.length
    var up = anchor.y + anchor.h / 2 > screen.h / 2
    var room = up ? anchor.y : screen.h - (anchor.y + anchor.h)
    var maxRows = Math.max(1, Math.floor(room / ROW_H))
    var columns = Math.max(1, Math.ceil(count / maxRows))
    var rows = Math.max(1, Math.ceil(count / columns))
    var colW = []
    var total = 0
    for (var c = 0; c < columns; c++) {
      var w = 1
      for (var i = c * rows; i < Math.min(count, (c + 1) * rows); i++) w = Math.max(w, widths[i])
      colW.push(w)
      total += w
    }
    if (total > screen.w) {
      // Too wide even so: squeeze the columns evenly.
      for (var s = 0; s < columns; s++) colW[s] = Math.max(1, Math.floor(screen.w / columns))
      total = colW[0] * columns
    }
    var x0 = Math.max(0, Math.min(anchor.x, screen.w - total))
    var rects = []
    for (var n = 0; n < count; n++) {
      var col = Math.floor(n / rows)
      var row = n % rows
      var cx = x0
      for (var k = 0; k < col; k++) cx += colW[k]
      var y = up ? anchor.y - (rows - row) * ROW_H : anchor.y + anchor.h + row * ROW_H
      rects.push({ x: cx, y: Math.max(0, Math.min(y, screen.h - ROW_H)), w: colW[col], h: ROW_H })
    }
    return { rects: rects }
  }

  function inside(rect, x, y) {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
  }

  // ---- state ----

  // u.items: [{label, modid}] (modid null = Clear); u.rects: their screen rects while open.
  function ui() { return ns.modsUi || (ns.modsUi = { screen: null, button: null, items: [], rects: [], open: false, mouse: null }) }

  var listCache = null
  function loadList() {
    if (listCache) return listCache
    var list = []
    try {
      list = visibleEntries(parseList(JsonIO.readString(LIST_PATH)), function (id) { return Platform.isLoaded(id) })
    } catch (err) {
      ns.diag.logError('load mods.json', err)
    }
    listCache = list
    return list
  }

  function searchWidget() { return ns.interop.cls('dev.emi.emi.screen.EmiScreenManager').search }

  function currentSearch() {
    var w = searchWidget()
    return w == null ? '' : String(w.getValue())
  }

  function literal(s) { return ns.interop.cls('net.minecraft.network.chat.Component').literal(s) }

  function rectOf(w) { return { x: w.getX(), y: w.getY(), w: w.getWidth(), h: w.getHeight() } }

  // Row text as drawn (the active mod is marked with a leading "> ").
  function rowText(item, cur) {
    return (item.modid !== null && isActive(cur, item.modid) ? '> ' : '') + item.label
  }

  // Pixel width of each row, measured with the "> " marker included so a row never changes
  // width when it becomes active.
  function measureRows(u) {
    var widths = []
    for (var i = 0; i < u.items.length; i++) widths.push(textWidth('> ' + u.items[i].label) + 2 * PAD)
    return widths
  }

  function layoutItems(u) {
    if (!u.widths || u.widths.length !== u.items.length) u.widths = measureRows(u)
    u.rects = layoutMenu(rectOf(u.button), u.widths,
      { w: u.screen.width, h: u.screen.height }).rects
  }

  function setOpen(u, open) {
    u.open = open
    u.rects = []
    if (open) u.widths = null
    if (open) layoutItems(u)
  }

  function choose(modid) {
    var u = ui()
    var w = searchWidget()
    if (w != null) w.setValue(modid === null ? '' : nextSearch(String(w.getValue()), modid))
    setOpen(u, false)
  }

  function toggle() {
    var u = ui()
    if (u.button != null) setOpen(u, !u.open)
  }

  function rowAt(u, x, y) {
    for (var i = 0; i < u.rects.length; i++) if (inside(u.rects[i], x, y)) return i
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

  // ---- Text without ambiguous overloads ----
  // In KubeJS 2001.6.5 the String/Component/FormattedCharSequence overloads of
  // GuiGraphics.drawString and Font.width are "ambiguous" (InternalError), and neither SRG
  // names nor explicit signatures resolve on these objects (client.log, 25fcb0f). So the
  // menu avoids them: labels are drawn with GuiGraphics.drawWordWrap(Font, FormattedText,
  // int, int, int, int), the only drawWordWrap overload in 1.20.1 (javap, Forge 47.2.20
  // client jar: one method, m_280554_), and widths are estimated from vanilla's default
  // font metrics instead of calling Font.width.
  var WRAP_WIDTH = 1000 // wider than any label, so drawWordWrap never wraps

  function drawText(g, font, text, x, y, color) {
    g.drawWordWrap(font, literal(String(text)), x, y, WRAP_WIDTH, color)
  }

  // Advance widths (glyph + 1 px spacing) of the narrow glyphs of Minecraft's default font;
  // every other ASCII glyph is 6 px or less, so 6 is a safe upper bound.
  var NARROW = { ' ': 4, '!': 2, "'": 2, ',': 2, '.': 2, ':': 2, ';': 2, 'i': 2, '|': 2, 'l': 3, 'I': 4, 't': 4, 'f': 5, 'k': 5, '>': 5, '<': 5, '(': 5, ')': 5, '[': 4, ']': 4 }

  function textWidth(text) {
    var w = 0
    for (var i = 0; i < text.length; i++) {
      var n = NARROW[text.charAt(i)]
      w += n === undefined ? 6 : n
    }
    return w
  }

  // Logs each failure site once per script load, never per frame.
  var reported = {}
  function logOnce(where, err) {
    if (reported[where]) return
    reported[where] = true
    ns.diag.logError(where, err)
  }

  // One-time evidence for the next launch: which draw-ish members the GuiGraphics object
  // exposes to this script.
  var diagLogged = false
  function logDrawMembers(g) {
    if (diagLogged) return
    diagLogged = true
    try {
      var names = []
      for (var key in g) if (String(key).toLowerCase().indexOf('draw') >= 0) names.push(String(key))
      ns.diag.info('GuiGraphics members containing "draw": ' + names.join(', '))
    } catch (err) {
      ns.diag.info('GuiGraphics member listing failed: ' + err)
    }
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
    logDrawMembers(g)
    var font = ns.interop.cls('net.minecraft.client.Minecraft').getInstance().font
    var cur = currentSearch()
    var hover = rowAt(u, mouseX, mouseY)
    var bounds = { x1: 1e9, y1: 1e9, x2: -1e9, y2: -1e9 }
    for (var i = 0; i < u.rects.length; i++) {
      var r = u.rects[i]
      bounds.x1 = Math.min(bounds.x1, r.x); bounds.y1 = Math.min(bounds.y1, r.y)
      bounds.x2 = Math.max(bounds.x2, r.x + r.w); bounds.y2 = Math.max(bounds.y2, r.y + r.h)
    }
    g.pose().pushPose()
    try {
      g.pose().translate(0, 0, DRAW_Z)
      g.fill(bounds.x1 - 1, bounds.y1 - 1, bounds.x2 + 1, bounds.y2 + 1, COLOR_BORDER)
      for (var j = 0; j < u.rects.length; j++) {
        var rr = u.rects[j]
        var active = u.items[j].modid !== null && isActive(cur, u.items[j].modid)
        g.fill(rr.x, rr.y, rr.x + rr.w, rr.y + rr.h, j === hover ? COLOR_HOVER : (active ? COLOR_ACTIVE : COLOR_BACK))
      }
      g.flush()
      // Text via drawWordWrap (see drawText), an opaque ARGB
      // colour, above the fills.
      g.pose().translate(0, 0, 50)
      for (var k = 0; k < u.rects.length; k++) {
        var rk = u.rects[k]
        drawText(g, font, rowText(u.items[k], cur), rk.x + PAD, rk.y + 2, COLOR_TEXT)
      }
      g.flush()
    } finally {
      g.pose().popPose()
    }
  }

  // ---- Forge event handlers ----

  function isContainer(screen) {
    return screen instanceof ns.interop.cls('net.minecraft.client.gui.screens.inventory.AbstractContainerScreen')
  }

  function onScreenInit(e) {
    var screen = e.getScreen()
    if (!isContainer(screen)) return
    var Button = ns.interop.cls('net.minecraft.client.gui.components.Button')
    var u = ui()
    var button = Button.builder(literal(BUTTON_LABEL), function () {
      try { global.emiCuration.modsMenuHandlers.toggle() } catch (err) {
        try { global.emiCuration.diag.logError('mods press', err) } catch (ignored) {}
      }
    }).bounds(0, 0, BUTTON_W, 18).build()
    button.visible = false
    var items = [{ label: CLEAR_LABEL, modid: null }]
    var list = loadList()
    for (var i = 0; i < list.length; i++) items.push({ label: list[i].label, modid: list[i].modid })
    u.screen = screen
    u.button = button
    u.items = items
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
    if (!isContainer(screen)) return
    u.screen = screen
    u.mouse = { x: e.getMouseX(), y: e.getMouseY() }
    update(u, screen)
  }

  function onScreenPost(e) {
    var u = ui()
    if (!u.open || u.rects.length === 0) return
    if (!isContainer(e.getScreen())) return
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
      if (e.getButton() === 0) choose(u.items[row].modid)
      return
    }
    if (inside(rectOf(u.button), x, y)) return
    setOpen(u, false)
  }

  // Esc closes the menu and is consumed, so it does not also close the screen.
  function onKeyPressed(e) {
    var u = ui()
    if (!u.open || e.getKeyCode() !== ESC) return
    setOpen(u, false)
    e.setCanceled(true)
  }

  ns.modsMenu = {
    parseList: parseList, visibleEntries: visibleEntries, searchText: searchText,
    isActive: isActive, nextSearch: nextSearch, layoutMenu: layoutMenu, BUTTON_W: BUTTON_W
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
  if (!global.emiCurationModsListeners) {
    global.emiCurationModsListeners = true
    var bus = Java.loadClass('net.minecraftforge.common.MinecraftForge').EVENT_BUS
    var NORMAL = Java.loadClass('net.minecraftforge.eventbus.api.EventPriority').NORMAL
    var hook = function (className, name) {
      bus.addListener(NORMAL, false, Java.loadClass(className), function (e) {
        try { global.emiCuration.modsMenuHandlers[name](e) } catch (err) { console.error('EMI curation (mods ' + name + ' listener): ' + err) }
      })
    }
    hook('net.minecraftforge.client.event.ScreenEvent$Init$Post', 'screenInit')
    hook('net.minecraftforge.client.event.ScreenEvent$Render$Pre', 'screenRender')
    hook('net.minecraftforge.client.event.ScreenEvent$Render$Post', 'screenPost')
    hook('net.minecraftforge.client.event.RenderTooltipEvent$Pre', 'tooltip')
    hook('net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre', 'mousePressed')
    hook('net.minecraftforge.client.event.ScreenEvent$KeyPressed$Pre', 'keyPressed')
  }
})(global.emiCuration || (global.emiCuration = {}))
