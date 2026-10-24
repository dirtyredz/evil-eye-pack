// priority: 95
// Length / element access that works for JS arrays and Java lists alike. Pure JS (no Java
// classes), so policy.js and the Node tests use the same copy as the interop-facing views.
// Rhino rules: no for...of / Array.from on Java collections; use len()/at() index loops.

(function (ns) {
  function len(list) {
    if (list === null || list === undefined) return 0
    return typeof list.size === 'function' ? list.size() : list.length
  }

  function at(list, i) {
    return typeof list.get === 'function' ? list.get(i) : list[i]
  }

  // Resource-id parts; a colonless value is a namespace with an empty path.
  function splitId(id) {
    var colon = id.indexOf(':')
    return { namespace: colon === -1 ? id : id.substring(0, colon), path: colon === -1 ? '' : id.substring(colon + 1) }
  }

  function namespaceOf(id) { return splitId(id).namespace }

  ns.ids = { split: splitId, namespaceOf: namespaceOf }
  ns.collections = { len: len, at: at }
})(global.emiCuration || (global.emiCuration = {}))
