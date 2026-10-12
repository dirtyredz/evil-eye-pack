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

  ns.collections = { len: len, at: at }
})(global.emiCuration || (global.emiCuration = {}))
