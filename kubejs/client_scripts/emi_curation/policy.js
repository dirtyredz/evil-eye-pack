// priority: 90
// EMI curation policy: parses config/emi-curation/*.json and answers "is this stack /
// recipe display hidden in CLEAN?". Pure logic: no EMI mutation and no Java classes, so
// the same file runs under KubeJS Rhino and under the Node tests.
// Rhino rules: no for...of / Array.from on Java collections; use len()/at() index loops.

(function (ns) {
  var SCHEMA = 1
  var ID_RE = /^[a-z0-9_.-]+:[a-z0-9_.\/-]+$/
  var CURATION_DIR = 'config/emi-curation/'

  var len = ns.collections.len
  var at = ns.collections.at

  function fail(msg) { throw new Error('emi-curation: ' + msg) }

  function requireStringArray(value, where) {
    if (!Array.isArray(value)) fail(where + ' must be an array')
    for (var i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string' || value[i] === '') fail(where + '[' + i + '] must be a non-empty string')
    }
    return value
  }

  function requireId(id, where) {
    if (!ID_RE.test(id)) fail(where + ': invalid id ' + JSON.stringify(id))
    return id
  }

  // Builds the compiled policy. `lists` maps list file name -> parsed list document.
  function compile(rules, lists) {
    if (!rules || rules.schema !== SCHEMA) fail('rules.json schema must be ' + SCHEMA)
    var policy = {
      itemIds: {},
      itemIdCount: 0,
      idContains: requireStringArray(rules.idContains || [], 'idContains').slice(),
      namespaces: {},
      nbtExceptions: {},
      displayFiltering: !!(rules.displayFiltering && rules.displayFiltering.clean === true),
      idCache: {}
    }
    var files = requireStringArray(rules.itemLists, 'itemLists')
    for (var f = 0; f < files.length; f++) {
      var doc = lists[files[f]]
      if (!doc) fail('missing item list ' + files[f])
      if (doc.schema !== SCHEMA) fail(files[f] + ': schema must be ' + SCHEMA)
      var items = requireStringArray(doc.items, files[f] + '.items')
      for (var i = 0; i < items.length; i++) {
        requireId(items[i], files[f])
        if (policy.itemIds[items[i]] === true) fail('duplicate item id ' + items[i] + ' (' + files[f] + ')')
        policy.itemIds[items[i]] = true
        policy.itemIdCount++
      }
    }
    var spaces = requireStringArray(rules.namespaces || [], 'namespaces')
    for (var n = 0; n < spaces.length; n++) policy.namespaces[spaces[n]] = true
    var ex = rules.nbtExceptions || []
    if (!Array.isArray(ex)) fail('nbtExceptions must be an array')
    for (var e = 0; e < ex.length; e++) {
      var keep = ex[e].keepWhenNbtEquals
      if (!keep || typeof keep !== 'object' || Array.isArray(keep)) fail('nbtExceptions[' + e + '].keepWhenNbtEquals must be an object')
      var ids = requireStringArray(ex[e].ids, 'nbtExceptions[' + e + '].ids')
      for (var k = 0; k < ids.length; k++) {
        requireId(ids[k], 'nbtExceptions')
        if (policy.nbtExceptions[ids[k]]) fail('duplicate nbt exception id ' + ids[k])
        policy.nbtExceptions[ids[k]] = keep
      }
    }
    return policy
  }

  // Reads rules.json and its lists through readText(path) (JsonIO.readString in game).
  function load(readText) {
    var rules = JSON.parse(String(readText(CURATION_DIR + 'rules.json')))
    var lists = {}
    var files = requireStringArray(rules.itemLists, 'itemLists')
    for (var i = 0; i < files.length; i++) {
      lists[files[i]] = JSON.parse(String(readText(CURATION_DIR + files[i])))
    }
    return compile(rules, lists)
  }

  // 'hide' | 'show' | 'nbt' (hidden unless the stack's NBT equals the exception).
  function classifyId(policy, id, isItem) {
    var key = (isItem ? 'i|' : 'o|') + id
    var cached = policy.idCache[key]
    if (cached !== undefined) return cached
    var result = 'show'
    var colon = id.indexOf(':')
    var namespace = colon === -1 ? id : id.substring(0, colon)
    if (isItem && policy.itemIds[id] === true) result = 'hide'
    else if (policy.namespaces[namespace] === true) result = 'hide'
    else {
      for (var i = 0; i < policy.idContains.length; i++) {
        if (id.indexOf(policy.idContains[i]) !== -1) { result = 'hide'; break }
      }
      if (result === 'show' && isItem && policy.nbtExceptions[id]) result = 'nbt'
    }
    policy.idCache[key] = result
    return result
  }

  // Structural NBT equality over plain values (objects, arrays, strings, tagged numbers).
  // Key order never matters; extra keys on either side make the values different.
  function nbtEquals(a, b) {
    if (a === b) return true
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
    if (Array.isArray(a) !== Array.isArray(b)) return false
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false
      for (var i = 0; i < a.length; i++) if (!nbtEquals(a[i], b[i])) return false
      return true
    }
    var ka = Object.keys(a)
    var kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    for (var j = 0; j < ka.length; j++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[j])) return false
      if (!nbtEquals(a[ka[j]], b[ka[j]])) return false
    }
    return true
  }

  // desc = { id: 'ns:path', isItem: boolean, nbt: function () -> plain NBT object | null }
  function isStackHidden(policy, desc) {
    var c = classifyId(policy, desc.id, desc.isItem)
    if (c !== 'nbt') return c === 'hide'
    var nbt = desc.nbt ? desc.nbt() : null
    return !nbtEquals(nbt, policy.nbtExceptions[desc.id])
  }

  // REI 12.1.785 FilteredStacksVisibilityHandler rule: a display is hidden when ANY
  // non-empty input or output ingredient has ALL of its alternatives hidden. Empty
  // ingredients never hide a display; catalysts are not examined (callers pass only
  // inputs and outputs).
  function isDisplayHidden(ingredientLists, alternativesOf, isEmptyIngredient, isHidden) {
    for (var l = 0; l < ingredientLists.length; l++) {
      var list = ingredientLists[l]
      for (var i = 0; i < len(list); i++) {
        var ingredient = at(list, i)
        if (isEmptyIngredient(ingredient)) continue
        var alts = alternativesOf(ingredient)
        var n = len(alts)
        if (n === 0) continue
        var allHidden = true
        for (var a = 0; a < n; a++) {
          if (!isHidden(at(alts, a))) { allHidden = false; break }
        }
        if (allHidden) return true
      }
    }
    return false
  }

  ns.policy = {
    SCHEMA: SCHEMA,
    compile: compile,
    load: load,
    classifyId: classifyId,
    nbtEquals: nbtEquals,
    isStackHidden: isStackHidden,
    isDisplayHidden: isDisplayHidden
  }
})(global.emiCuration || (global.emiCuration = {}))
