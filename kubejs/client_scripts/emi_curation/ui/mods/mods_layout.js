// priority: 48
// Pure geometry of the Mods dropdown: no Java, no EMI, unit-tested directly.
//
// layoutMenu: one stack of rows (extra columns only when the height runs out), opened upward
//   from an anchor in the lower half of the screen and downward otherwise.
// layoutPaged: layoutMenu when everything fits on screen; otherwise pages of columns that fit
//   the screen width, plus a "< Prev | Next >" strip on the row next to the anchor.
// Both clamp every rect to the screen and never place a row on the anchor itself.

(function (ns) {
  var ROW_H = 12
  var PAGER_MIN_W = 40

  function opensUp(anchor, screen) { return anchor.y + anchor.h / 2 > screen.h / 2 }

  function roomRows(anchor, screen, up) {
    var room = up ? anchor.y : screen.h - (anchor.y + anchor.h)
    return Math.floor(room / ROW_H)
  }

  function clampY(y, screen) { return Math.max(0, Math.min(y, screen.h - ROW_H)) }

  // anchor: the Mods button rect; widths: each row's width. Returns { rects, fits } with one
  // rect per row; fits is false when the columns are wider than the screen (they are then
  // squeezed evenly, which callers should replace by paging).
  function layoutMenu(anchor, widths, screen) {
    var count = widths.length
    var up = opensUp(anchor, screen)
    var maxRows = Math.max(1, roomRows(anchor, screen, up))
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
    var fits = total <= screen.w
    if (!fits) {
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
      rects.push({ x: cx, y: clampY(y, screen), w: colW[col], h: ROW_H })
    }
    return { rects: rects, fits: fits }
  }

  // Splits `widths` into pages. Each column holds up to `rows` entries; columns are added to a
  // page while their summed width still fits `maxW`. Returns [[{from, to, w}]] (to exclusive).
  function paginate(widths, rows, maxW) {
    var pages = []
    var cur = []
    var curW = 0
    for (var from = 0; from < widths.length; from += rows) {
      var to = Math.min(widths.length, from + rows)
      var w = 1
      for (var i = from; i < to; i++) w = Math.max(w, widths[i])
      w = Math.min(w, maxW)
      if (cur.length > 0 && curW + w > maxW) {
        pages.push(cur)
        cur = []
        curW = 0
      }
      cur.push({ from: from, to: to, w: w })
      curW += w
    }
    if (cur.length > 0) pages.push(cur)
    return pages
  }

  // Result: { page, pageCount, rows: [{ index, rect }], pager: null | { prev, next } }.
  // `page` is clamped to the valid range. Item rows come in index order.
  function layoutPaged(anchor, widths, screen, page) {
    var single = layoutMenu(anchor, widths, screen)
    var i
    if (single.fits) {
      var all = []
      for (i = 0; i < widths.length; i++) all.push({ index: i, rect: single.rects[i] })
      return { page: 0, pageCount: 1, rows: all, pager: null }
    }
    var up = opensUp(anchor, screen)
    var rowsPerCol = Math.max(1, roomRows(anchor, screen, up) - 1)
    var pages = paginate(widths, rowsPerCol, screen.w)
    var p = Math.max(0, Math.min(page || 0, pages.length - 1))
    var cols = pages[p]
    var total = 0
    for (i = 0; i < cols.length; i++) total += cols[i].w
    var stripW = Math.min(screen.w, Math.max(total, 2 * PAGER_MIN_W))
    var x0 = Math.max(0, Math.min(anchor.x, screen.w - stripW))
    var stripY = clampY(up ? anchor.y - ROW_H : anchor.y + anchor.h, screen)
    var half = Math.floor(stripW / 2)
    var tallest = 0
    for (i = 0; i < cols.length; i++) tallest = Math.max(tallest, cols[i].to - cols[i].from)
    var rows = []
    var cx = x0
    for (var c = 0; c < cols.length; c++) {
      for (var r = 0; r < cols[c].to - cols[c].from; r++) {
        var y = up ? stripY - (tallest - r) * ROW_H : stripY + ROW_H + r * ROW_H
        rows.push({ index: cols[c].from + r, rect: { x: cx, y: clampY(y, screen), w: cols[c].w, h: ROW_H } })
      }
      cx += cols[c].w
    }
    return {
      page: p,
      pageCount: pages.length,
      rows: rows,
      pager: {
        prev: { x: x0, y: stripY, w: half, h: ROW_H },
        next: { x: x0 + half, y: stripY, w: stripW - half, h: ROW_H }
      }
    }
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  }

  // Horizontal shift that moves the whole dropdown (the bounding box of `rects`) clear of the
  // `avoid` rects (the other buttons), staying on screen. Smallest shift first; 0 when it
  // already clears them or no shift does.
  function shiftClear(rects, avoid, screenW) {
    if (rects.length === 0) return 0
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9
    var i
    for (i = 0; i < rects.length; i++) {
      x1 = Math.min(x1, rects[i].x); y1 = Math.min(y1, rects[i].y)
      x2 = Math.max(x2, rects[i].x + rects[i].w); y2 = Math.max(y2, rects[i].y + rects[i].h)
    }
    var box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
    var hit = false
    var cands = []
    for (i = 0; i < avoid.length; i++) {
      if (!overlaps(box, avoid[i])) continue
      hit = true
      cands.push(avoid[i].x + avoid[i].w - x1, avoid[i].x - x2)
    }
    if (!hit) return 0
    cands.sort(function (a, b) { return Math.abs(a) - Math.abs(b) })
    for (var c = 0; c < cands.length; c++) {
      var moved = { x: x1 + cands[c], y: y1, w: box.w, h: box.h }
      if (moved.x < 0 || moved.x + moved.w > screenW) continue
      var clear = true
      for (i = 0; i < avoid.length; i++) if (overlaps(moved, avoid[i])) { clear = false; break }
      if (clear) return cands[c]
    }
    return 0
  }

  function inside(rect, x, y) {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
  }

  ns.modsLayout = { ROW_H: ROW_H, layoutMenu: layoutMenu, paginate: paginate, layoutPaged: layoutPaged, shiftClear: shiftClear, inside: inside }
})(global.emiCuration || (global.emiCuration = {}))
