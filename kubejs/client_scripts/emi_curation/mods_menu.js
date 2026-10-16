// priority: 45
// "Mods" dropdown beside the CLEAN/ALL button. Choosing a mod sets EMI's search text to
// "@<modid>" (exactly as if the player typed it), choosing the active mod again or
// "Clear" empties it. A click outside the menu or Esc closes it without changing
// anything. The mod list is config/emi-curation/mods.json ([{label, modid}]); entries
// whose mod is not loaded are dropped.
//
// The menu is a set of pre-built Button widgets (one per entry) that this script shows,
// lays out and hides, so no Java interface has to be implemented from JS. The search is
// set with EmiScreenManager.search.setValue(...): EditBox.setValue runs the widget's
// responder, which is what makes EMI refilter (the same path as typing).
//
// Forge listeners survive /kubejs reload, so they are registered once and dispatch
// through global.emiCuration.modsMenuHandlers, which every reload replaces.

(function (ns) {
  var LIST_PATH = 'config/emi-curation/mods.json'
  var BUTTON_W = 56
  var BUTTON_LABEL = 'Mods ▾'
  var ROW_H = 16
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

  // Pure menu layout. anchor: the Mods button rect. Returns { rects:[{x,y,w,h}] } for
  // `count` rows, opened upward when the anchor is in the lower half of the screen,
  // wrapping into extra columns when one column does not fit.
  function layoutMenu(anchor, count, screen, width) {
    var up = anchor.y + anchor.h / 2 > screen.h / 2
    var room = up ? anchor.y : screen.h - (anchor.y + anchor.h)
    var maxRows = Math.max(1, Math.floor(room / ROW_H))
    var columns = Math.max(1, Math.ceil(count / maxRows))
    var rows = Math.max(1, Math.ceil(count / columns))
    var x0 = Math.max(0, Math.min(anchor.x, screen.w - columns * width))
    var rects = []
    for (var i = 0; i < count; i++) {
      var col = Math.floor(i / rows)
      var row = i % rows
      var y = up ? anchor.y - (rows - row) * ROW_H : anchor.y + anchor.h + row * ROW_H
      rects.push({ x: x0 + col * width, y: Math.max(0, y), w: width, h: ROW_H })
    }
    return { rects: rects }
  }

  function inside(rect, x, y) {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
  }

  // ---- state ----

  function ui() { return ns.modsUi || (ns.modsUi = { screen: null, button: null, items: [], open: false }) }

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

  // ---- widgets ----

  function setOpen(u, open) {
    u.open = open
    for (var i = 0; i < u.items.length; i++) u.items[i].btn.visible = false
    if (open) { refreshLabels(u); layoutItems(u) }
  }

  // The active mod is marked with a leading "> ".
  function refreshLabels(u) {
    var cur = currentSearch()
    for (var i = 0; i < u.items.length; i++) {
      var it = u.items[i]
      var text = it.modid !== null && isActive(cur, it.modid) ? '> ' + it.label : it.label
      if (String(it.btn.getMessage().getString()) !== text) it.btn.setMessage(literal(text))
    }
  }

  function menuWidth(u) {
    var longest = 0
    for (var i = 0; i < u.items.length; i++) longest = Math.max(longest, u.items[i].label.length)
    return Math.max(BUTTON_W, longest * 6 + 16)
  }

  function layoutItems(u) {
    var lay = layoutMenu(rectOf(u.button), u.items.length,
      { w: u.screen.width, h: u.screen.height }, menuWidth(u))
    for (var i = 0; i < u.items.length; i++) {
      var b = u.items[i].btn
      b.setX(lay.rects[i].x)
      b.setY(lay.rects[i].y)
      b.setWidth(lay.rects[i].w)
      b.visible = true
    }
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

  function makeItem(Button, label, modid) {
    var btn = Button.builder(literal(label), function () {
      // Resolve through global at press time so reloaded code is used.
      try { global.emiCuration.modsMenuHandlers.choose(modid) } catch (err) {
        try { global.emiCuration.diag.logError('mods choose', err) } catch (ignored) {}
      }
    }).bounds(0, 0, BUTTON_W, ROW_H).build()
    btn.visible = false
    return { btn: btn, label: label, modid: modid }
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
    if (u.open) { refreshLabels(u); layoutItems(u) }
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
    var items = [makeItem(Button, CLEAR_LABEL, null)]
    var list = loadList()
    for (var i = 0; i < list.length; i++) items.push(makeItem(Button, list[i].label, list[i].modid))
    u.screen = screen
    u.button = button
    u.items = items
    u.open = false
    e.addListener(button)
    for (var j = 0; j < items.length; j++) e.addListener(items[j].btn)
    update(u, screen)
  }

  function onScreenRender(e) {
    var u = ui()
    if (u.button == null) return
    // Use the event's own screen (see button.js: no identity match is trusted).
    var screen = e.getScreen()
    if (!isContainer(screen)) return
    u.screen = screen
    update(u, screen)
  }

  // A click outside the menu and its button closes it; the click itself is not consumed.
  function onMousePressed(e) {
    var u = ui()
    if (!u.open) return
    var x = e.getMouseX()
    var y = e.getMouseY()
    if (inside(rectOf(u.button), x, y)) return
    for (var i = 0; i < u.items.length; i++) if (inside(rectOf(u.items[i].btn), x, y)) return
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
    hook('net.minecraftforge.client.event.ScreenEvent$MouseButtonPressed$Pre', 'mousePressed')
    hook('net.minecraftforge.client.event.ScreenEvent$KeyPressed$Pre', 'keyPressed')
  }
})(global.emiCuration || (global.emiCuration = {}))
