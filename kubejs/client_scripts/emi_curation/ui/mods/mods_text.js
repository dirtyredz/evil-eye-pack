// priority: 46
// Text for the Mods menu without ambiguous Java overloads.
//
// In KubeJS 2001.6.5 the String/Component/FormattedCharSequence overloads of
// GuiGraphics.drawString and Font.width are "ambiguous" (InternalError), and neither SRG
// names nor explicit signatures resolve on these objects (client.log, 25fcb0f). So labels
// are drawn with GuiGraphics.drawWordWrap(Font, FormattedText, int, int, int, int), the
// only drawWordWrap overload in 1.20.1 (javap, Forge 47.2.20 client jar: one method,
// m_280554_), and widths are estimated from vanilla's default font metrics instead of
// calling Font.width. Never call drawString or Font.width from these scripts.

(function (ns) {
  var WRAP_WIDTH = 1000 // wider than any label, so drawWordWrap never wraps

  // Advance widths (glyph + 1 px spacing) of the narrow glyphs of Minecraft's default font;
  // every other ASCII glyph is 6 px or less, so 6 is a safe upper bound.
  var NARROW = { ' ': 4, '!': 2, "'": 2, ',': 2, '.': 2, ':': 2, ';': 2, 'i': 2, '|': 2, 'l': 3, 'I': 4, 't': 4, 'f': 5, 'k': 5, '>': 5, '<': 5, '(': 5, ')': 5, '[': 4, ']': 4 }

  // `color` is a signed ARGB int (0xFFFFFFFF | 0).
  function draw(g, font, text, x, y, color) {
    g.drawWordWrap(font, ns.interop.literal(String(text)), x, y, WRAP_WIDTH, color)
  }

  function width(text) {
    var w = 0
    for (var i = 0; i < text.length; i++) {
      var n = NARROW[text.charAt(i)]
      w += n === undefined ? 6 : n
    }
    return w
  }

  ns.modsText = { draw: draw, width: width }
})(global.emiCuration || (global.emiCuration = {}))
