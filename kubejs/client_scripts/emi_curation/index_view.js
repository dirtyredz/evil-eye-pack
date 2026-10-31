// priority: 80
// Reversible curated view of EMI's item index (pinned to EMI 1.1.24+1.20.1+forge).
//
// EMI keeps the master list in EmiStackList.stacks and the ordinary visible list in
// EmiStackList.filteredStacks (rebuilt by bakeFiltered(): master minus disabled and
// user-hidden stacks). The INDEX sidebar and search read filteredStacks. CLEAN swaps in
// an immutable filtered copy of the ordinary list; ALL puts the ordinary list back.
// The master list, EMI's user-hidden set and its persistent data are never touched.

(function (ns) {
  var STACK_LIST = 'dev.emi.emi.registry.EmiStackList'

  function stackList() { return ns.interop.cls(STACK_LIST) }

  // The list EMI currently shows (ours or EMI's own).
  function currentFiltered() { return stackList().filteredStacks }

  // EMI's master index list; a new object after every EMI bake (reload generation).
  function currentMaster() { return stackList().stacks }

  function install(list) {
    stackList().filteredStacks = list
    // KubeJS 2101 coerces a value assigned to a static java.util.List field through
    // Context.listOf. The field can therefore hold a different Java List object than
    // `list`; callers must track the reference EMI actually received.
    return currentFiltered()
  }

  // Re-run the active search and rebuild sidebars/craftables without an EMI reload.
  function refresh() {
    var EmiScreenManager = ns.interop.cls('dev.emi.emi.screen.EmiScreenManager')
    if (EmiScreenManager.search != null) ns.interop.cls('dev.emi.emi.search.EmiSearch').update()
    EmiScreenManager.forceRecalculate()
  }

  ns.indexView = {
    currentFiltered: currentFiltered,
    currentMaster: currentMaster,
    install: install,
    refresh: refresh
  }
})(global.emiCuration || (global.emiCuration = {}))
