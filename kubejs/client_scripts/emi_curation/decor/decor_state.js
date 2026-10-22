// priority: 62
// The single home of DECOR state: the shipped rules (decor.json), the owner's local marks
// (decor-local.json), the per-key classification cache, the tag-set cache, and the SHOWN/HIDDEN
// mode with its button labels. session.js owns the CLEAN/ALL lifecycle and re-applies the index;
// it asks this file what is decor. Recipe displays never consult it ("hide from the index only").
//
// - isHidden(stack): local marks decide first, otherwise the decor.json layers (tags through
//   decor_tags.js). Cached per registry key (Item/Fluid object).
// - invalidate(): the one reset. Call it when EMI starts a new index generation (tag contents
//   depend on the joined world) and when the local marks change.
// - The mode override lives in ns.decorMode so /kubejs reload keeps it; resetMode() (logout)
//   returns to decor.json's default.

(function (ns) {
  var SHOWN = 'SHOWN'
  var HIDDEN = 'HIDDEN'

  var rules = null
  // Local DECOR marks: { data, status }, see decor_local.js. Always present.
  var local = { data: ns.decorLocal.empty(), status: 'missing', error: null }
  var classCache = null

  var modeState = ns.decorMode || (ns.decorMode = { override: null }) // null = decor.json's default

  // decor.json is optional for CLEAN: a bad file disables the DECOR button, nothing else.
  function loadRules(readString) {
    try {
      return ns.decorPolicy.load(readString)
    } catch (err) {
      ns.diag.logError('load decor.json', err)
      return null
    }
  }

  // A malformed decor-local.json is logged once here and ignored; the shipped rules still apply.
  function loadLocal() {
    var loaded = ns.decorLocal.load(ns.decorLocal.kubeIo())
    if (loaded.status === 'malformed') ns.diag.logError('load decor-local.json', loaded.error)
    return loaded
  }

  function load(readString) {
    rules = loadRules(readString)
    local = loadLocal()
    invalidate()
  }

  function available() { return rules != null }

  // Forget the per-key answers and the tag set.
  function invalidate() {
    classCache = null
    ns.decorTags.reset()
  }

  function classify(stack) {
    var desc = ns.interop.describe(stack)
    var mark = ns.decorLocal.lookup(local.data, desc.id)
    if (mark !== null) return mark
    return ns.decorPolicy.classify(rules, desc.id, function () {
      return desc.isItem && ns.decorTags.itemSet(rules).contains(stack.getKey())
    })
  }

  function isHidden(stack) {
    if (rules == null) return false
    if (classCache == null) classCache = ns.interop.newIdentityMap()
    var key = stack.getKey()
    var c = classCache.get(key)
    if (c == null) {
      c = classify(stack)
      classCache.put(key, c)
    }
    return c === true || String(c) === 'true'
  }

  // ---- mode ----

  function mode() {
    if (rules == null) return SHOWN
    if (modeState.override != null) return modeState.override
    return rules.defaultHidden ? HIDDEN : SHOWN
  }

  function indexHidden() { return mode() === HIDDEN }

  // Flips the mode; returns the previous override so a failed apply can setOverride() it back.
  function flip() {
    var prev = modeState.override
    modeState.override = mode() === HIDDEN ? SHOWN : HIDDEN
    return prev
  }

  function setOverride(prev) { modeState.override = prev }

  function resetMode() { modeState.override = null }

  function label() { return rules == null ? 'DECOR: N/A' : 'DECOR: ' + mode() }

  // ---- local marks ----

  // Cycles the local mark for an item id (or its mod); on success the caches are dropped. The
  // caller re-applies the index. Returns decor_local's result.
  function mark(id, wholeMod) {
    var result = ns.decorLocal.mark(local, ns.decorLocal.kubeIo(), id, wholeMod)
    if (result.ok) invalidate()
    return result
  }

  ns.decorState = {
    load: load, available: available, invalidate: invalidate, isHidden: isHidden,
    mode: mode, indexHidden: indexHidden, flip: flip, setOverride: setOverride, resetMode: resetMode,
    label: label, mark: mark
  }
})(global.emiCuration || (global.emiCuration = {}))
