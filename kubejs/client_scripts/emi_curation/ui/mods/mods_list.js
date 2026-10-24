// priority: 47
// Pure data logic of the Mods menu, no Java: the override file (config/emi-curation/
// mods.json), building the sorted entry list from the mods that own indexed items, and
// search-text toggling. Layout lives in mods_layout.js.

(function (ns) {
  var MODID_RE = /^[a-z0-9_.-]+$/

  function fail(msg) { throw new Error('mods.json: ' + msg) }

  function modidArray(value, where) {
    if (value === undefined) return []
    if (!Array.isArray(value)) fail(where + ' must be an array')
    var out = []
    for (var i = 0; i < value.length; i++) {
      if (typeof value[i] === 'string' && MODID_RE.test(value[i])) out.push(value[i])
    }
    return out
  }

  // Parses the override file: { schema: 1, rename: {modid: "Label"}, hide: [modid], pin: [modid] }.
  // Malformed entries are dropped; a wrong shape throws.
  function parseOverrides(text) {
    var raw = JSON.parse(String(text))
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('must be an object')
    var rename = {}
    var src = raw.rename === undefined ? {} : raw.rename
    if (!src || typeof src !== 'object' || Array.isArray(src)) fail('rename must be an object')
    var keys = Object.keys(src)
    for (var i = 0; i < keys.length; i++) {
      var label = typeof src[keys[i]] === 'string' ? src[keys[i]].trim() : ''
      if (MODID_RE.test(keys[i]) && label !== '') rename[keys[i]] = label
    }
    return { rename: rename, hide: modidArray(raw.hide, 'hide'), pin: modidArray(raw.pin, 'pin') }
  }

  function emptyOverrides() { return { rename: {}, hide: [], pin: [] } }

  function byLabel(a, b) {
    var x = a.label.toLowerCase()
    var y = b.label.toLowerCase()
    if (x !== y) return x < y ? -1 : 1
    return a.modid < b.modid ? -1 : (a.modid > b.modid ? 1 : 0)
  }

  // owned: array of mod ids (namespaces) that own at least one item; isLoaded(modid) and
  // nameOf(modid) come from the loader (Platform). Returns [{label, modid}]: pinned mods first
  // in pin order, then everything else A-Z by label. Hidden, unloaded and duplicate ids drop out.
  function buildEntries(owned, isLoaded, nameOf, overrides) {
    var ov = overrides || emptyOverrides()
    var hidden = {}
    var i
    for (i = 0; i < ov.hide.length; i++) hidden[ov.hide[i]] = true
    var byId = {}
    var entries = []
    for (i = 0; i < owned.length; i++) {
      var id = owned[i]
      if (byId[id] || hidden[id] || !isLoaded(id)) continue
      var label = ov.rename[id] || String(nameOf(id) || '').trim() || id
      byId[id] = { label: label, modid: id }
      entries.push(byId[id])
    }
    var pinned = []
    for (i = 0; i < ov.pin.length; i++) {
      var p = byId[ov.pin[i]]
      if (p && pinned.indexOf(p) === -1) pinned.push(p)
    }
    var rest = []
    for (i = 0; i < entries.length; i++) if (pinned.indexOf(entries[i]) === -1) rest.push(entries[i])
    rest.sort(byLabel)
    return pinned.concat(rest)
  }

  function searchText(modid) { return '@' + modid }

  function isActive(current, modid) {
    return String(current).trim().toLowerCase() === searchText(modid)
  }

  // The search text to set when `modid` is chosen: the active mod toggles back to empty.
  function nextSearch(current, modid) {
    return isActive(current, modid) ? '' : searchText(modid)
  }

  ns.modsList = {
    parseOverrides: parseOverrides, emptyOverrides: emptyOverrides, buildEntries: buildEntries,
    searchText: searchText, isActive: isActive, nextSearch: nextSearch
  }
})(global.emiCuration || (global.emiCuration = {}))
