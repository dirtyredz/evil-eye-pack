// priority: 49
// (mods_list.js loads later, so ns.modsList is only touched inside functions.)
// Where the Mods menu entries come from: every loaded mod that owns at least one stack of
// EMI's current index (so CLEAN and DECOR changes show), named by Forge/KubeJS (Platform),
// A-Z, with config/emi-curation/mods.json applying renames, hides and pins (mods_list.js).

(function (ns) {
  var OVERRIDES_PATH = 'config/emi-curation/mods.json'

  var overridesCache = null
  function loadOverrides() {
    if (overridesCache) return overridesCache
    try {
      overridesCache = ns.modsList.parseOverrides(JsonIO.readString(OVERRIDES_PATH))
    } catch (err) {
      ns.diag.logError('load mods.json', err)
      overridesCache = ns.modsList.emptyOverrides()
    }
    return overridesCache
  }

  // Namespaces owning at least one stack of the list (EMI's current index), first-seen order.
  function ownedNamespaces(list) {
    var C = ns.collections
    var src = ns.interop.copy(list)
    var seen = {}
    var out = []
    for (var i = 0; i < C.len(src); i++) {
      var id = String(C.at(src, i).getId())
      var colon = id.indexOf(':')
      var space = colon === -1 ? id : id.substring(0, colon)
      if (!seen[space]) {
        seen[space] = true
        out.push(space)
      }
    }
    return out
  }

  function displayName(modid) {
    try {
      var info = Platform.getInfo(modid)
      return info == null ? modid : String(info.getName())
    } catch (err) {
      return modid
    }
  }

  // Entries for the index EMI shows right now; rebuilt only when that list object changes.
  var entriesCache = { list: null, entries: [] }
  function currentEntries() {
    var list = ns.indexView.currentFiltered()
    if (list == null) return []
    if (entriesCache.list == null || !ns.interop.sameRef(list, entriesCache.list)) {
      var entries = ns.modsList.buildEntries(ownedNamespaces(list), function (id) { return Platform.isLoaded(id) }, displayName, loadOverrides())
      entriesCache = { list: list, entries: entries }
    }
    return entriesCache.entries
  }


  ns.modsSource = { entries: currentEntries }
})(global.emiCuration || (global.emiCuration = {}))
