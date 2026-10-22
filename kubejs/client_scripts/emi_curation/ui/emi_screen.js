// priority: 57
// The one adapter over EMI's screen internals (EmiScreenManager): the search widget, whether it
// has the keyboard, and what stack or panel is under the mouse. Everything else in the scripts
// asks here instead of reaching into EmiScreenManager, so an EMI version bump touches one file.
// Every call is made at use time (nothing is cached), so a script reload needs no care.

(function (ns) {
  function manager() { return ns.interop.cls('dev.emi.emi.screen.EmiScreenManager') }

  // EMI's search EditBox; null until EMI has built it.
  function searchWidget() { return manager().search }

  function searchFocused() {
    var search = searchWidget()
    return search != null && search.isFocused()
  }

  // EMI's stack under the GUI-scaled mouse position (index, favorites, recipe screens, inventory
  // slots through its stack providers): the raw hit, null when nothing or an empty stack.
  function hoveredEmiStack(x, y) {
    var hit = manager().getHoveredStack(x, y, false)
    return hit == null || hit.isEmpty() ? null : hit
  }

  // True when one of EMI's panels (index, favorites) is at the point.
  function panelAt(x, y) { return manager().getHoveredPanel(x, y) != null }

  ns.emiScreen = { searchWidget: searchWidget, searchFocused: searchFocused, hoveredEmiStack: hoveredEmiStack, panelAt: panelAt }
})(global.emiCuration || (global.emiCuration = {}))
