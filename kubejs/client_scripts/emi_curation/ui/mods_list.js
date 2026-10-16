// priority: 47
// Pure logic of the Mods menu: mods.json parsing, search-text toggling, dropdown layout and
// hit-testing. No Java and no EMI, so it is unit-tested directly.

(function (ns) {
  var ROW_H = 12

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

  ns.modsList = {
    ROW_H: ROW_H, parseList: parseList, visibleEntries: visibleEntries, searchText: searchText,
    isActive: isActive, nextSearch: nextSearch, layoutMenu: layoutMenu, inside: inside
  }
})(global.emiCuration || (global.emiCuration = {}))
