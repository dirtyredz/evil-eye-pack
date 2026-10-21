// priority: 89
// DECOR policy: parses config/emi-curation/decor.json and answers "is this item id decor?".
// Pure logic (no Java, no EMI), so the same file runs under KubeJS Rhino and the Node tests.
//
// Three layers, checked in this order (first match wins):
//   1. manual exceptions: forceNotDecor, then forceDecor (exact ids)
//   2. whole mods: `mods` (exact namespaces), `modPrefixes` (namespace starts with, e.g. "mcw"),
//      `pathPrefixes` (namespace -> id paths starting with, e.g. herbalwitch "decor/")
//   3. tags: itemTags and blockTags. The Java side (decor_tags.js) turns those into a set of
//      items; this file only receives the answer as a lazy `inTags()` callback.

(function (ns) {
  var SCHEMA = 1
  var ID_RE = /^[a-z0-9_.-]+:[a-z0-9_.\/-]+$/
  var NS_RE = /^[a-z0-9_.-]+$/
  var CURATION_DIR = 'config/emi-curation/'

  function fail(msg) { throw new Error('emi-curation decor: ' + msg) }

  function strings(value, where, re) {
    if (value === undefined) return []
    if (!Array.isArray(value)) fail(where + ' must be an array')
    for (var i = 0; i < value.length; i++) {
      if (typeof value[i] !== 'string' || (re && !re.test(value[i]))) fail(where + '[' + i + '] is invalid: ' + JSON.stringify(value[i]))
    }
    return value
  }

  function set(list) {
    var out = {}
    for (var i = 0; i < list.length; i++) out[list[i]] = true
    return out
  }

  // Compiles the parsed decor.json document.
  function compile(doc) {
    if (!doc || doc.schema !== SCHEMA) fail('decor.json schema must be ' + SCHEMA)
    var paths = doc.pathPrefixes === undefined ? {} : doc.pathPrefixes
    if (!paths || typeof paths !== 'object' || Array.isArray(paths)) fail('pathPrefixes must be an object')
    var pathPrefixes = {}
    var keys = Object.keys(paths)
    for (var i = 0; i < keys.length; i++) {
      if (!NS_RE.test(keys[i])) fail('pathPrefixes: invalid namespace ' + JSON.stringify(keys[i]))
      pathPrefixes[keys[i]] = strings(paths[keys[i]], 'pathPrefixes.' + keys[i]).slice()
    }
    return {
      defaultHidden: doc.defaultHidden !== false,
      mods: set(strings(doc.mods, 'mods', NS_RE)),
      modPrefixes: strings(doc.modPrefixes, 'modPrefixes', NS_RE).slice(),
      pathPrefixes: pathPrefixes,
      itemTags: strings(doc.itemTags, 'itemTags', ID_RE).slice(),
      blockTags: strings(doc.blockTags, 'blockTags', ID_RE).slice(),
      forceDecor: set(strings(doc.forceDecor, 'forceDecor', ID_RE)),
      forceNotDecor: set(strings(doc.forceNotDecor, 'forceNotDecor', ID_RE))
    }
  }

  function load(readText) {
    return compile(JSON.parse(String(readText(CURATION_DIR + 'decor.json'))))
  }

  function startsWith(text, prefix) { return text.substring(0, prefix.length) === prefix }

  // True when the whole mod (or a path inside it) is decor. Layer 2.
  function isDecorMod(policy, namespace, path) {
    if (policy.mods[namespace] === true) return true
    for (var i = 0; i < policy.modPrefixes.length; i++) {
      if (startsWith(namespace, policy.modPrefixes[i])) return true
    }
    var prefixes = policy.pathPrefixes[namespace]
    if (prefixes) {
      for (var p = 0; p < prefixes.length; p++) if (startsWith(path, prefixes[p])) return true
    }
    return false
  }

  // id: 'ns:path'. inTags: function () -> boolean, only called when layers 1 and 2 do not
  // decide (it may build the tag sets, so it is lazy).
  function classify(policy, id, inTags) {
    if (policy.forceNotDecor[id] === true) return false
    if (policy.forceDecor[id] === true) return true
    var colon = id.indexOf(':')
    var namespace = colon === -1 ? id : id.substring(0, colon)
    var path = colon === -1 ? '' : id.substring(colon + 1)
    if (isDecorMod(policy, namespace, path)) return true
    return inTags ? !!inTags() : false
  }

  ns.decorPolicy = { SCHEMA: SCHEMA, compile: compile, load: load, classify: classify }
})(global.emiCuration || (global.emiCuration = {}))
